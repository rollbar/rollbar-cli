'use strict';

// Reads a secret from stdin into a Buffer, without echoing it or turning it into
// a string. Piped or redirected stdin is read to its end. A terminal gets a
// prompt on stderr and raw-mode input that isn't echoed, not even as asterisks.
// Every buffer the secret passes through is zeroed once it has been copied on.

const { SafeMessageError } = require('./errors');

const MAX_INPUT_BYTES = 1024;

const SUBMIT = 'submit';
const CANCEL = 'cancel';

class SecretInputError extends SafeMessageError {}

class PromptCancelled extends SafeMessageError {
  constructor() {
    super('Cancelled.');
  }
}

function tooLong() {
  return new SecretInputError(`The input is longer than ${MAX_INPUT_BYTES} bytes, too long to be an access token.`);
}

function readStream(stream) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;

    function discard() {
      chunks.forEach(function (chunk) { chunk.fill(0); });
      chunks.length = 0;
    }

    function stop() {
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
    }

    function onData(chunk) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(bytes);
      size += bytes.length;

      if (size > MAX_INPUT_BYTES) {
        stop();
        discard();
        stream.destroy();
        reject(tooLong());
      }
    }

    function onEnd() {
      stop();
      const input = Buffer.alloc(size);
      let offset = 0;
      chunks.forEach(function (chunk) {
        offset += chunk.copy(input, offset);
      });
      discard();
      resolve(input);
    }

    function onError(err) {
      stop();
      discard();
      reject(err);
    }

    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('error', onError);
  });
}

function readTerminal(stdin, stderr, prompt) {
  return new Promise(function (resolve, reject) {
    const buffer = Buffer.alloc(MAX_INPUT_BYTES);
    let length = 0;
    let overflow = false;
    let finished = false;
    // Where we are in a terminal escape sequence (an arrow key, say), whose
    // bytes aren't input: null, 'esc', 'csi' or 'ss3'.
    let escape = null;

    function erase() {
      // A character can be several UTF-8 bytes: a lead byte and continuation
      // bytes (10xxxxxx).
      while (length > 0) {
        length--;
        const b = buffer[length];
        buffer[length] = 0;
        if ((b & 0xc0) !== 0x80) {
          break;
        }
      }
    }

    // Whether b is part of the escape sequence we're in, moving on through it.
    // A control character (Enter, Ctrl-C, Backspace and so on) never is: it ends
    // the sequence and is handled as usual, so a lone Esc can't swallow it. Any
    // other byte after a lone Esc is taken as Alt with that key, and ignored.
    function continuesEscape(b) {
      if (b < 0x20 || b === 0x7f) {
        escape = null;
        return false;
      }
      if (escape === 'esc') {
        escape = b === 0x5b ? 'csi' : b === 0x4f ? 'ss3' : null;
      } else if (escape === 'csi') {
        escape = b >= 0x40 && b <= 0x7e ? null : 'csi';
      } else {
        escape = null;
      }
      return true;
    }

    function handleByte(b) {
      if (escape && continuesEscape(b)) {
        return null;
      }

      switch (b) {
        case 0x0d: // Enter
        case 0x0a:
        case 0x04: // Ctrl-D
          return SUBMIT;
        case 0x03: // Ctrl-C
          return CANCEL;
        case 0x1b:
          escape = 'esc';
          return null;
        case 0x7f: // Backspace
        case 0x08:
          erase();
          return null;
        case 0x15: // Ctrl-U
          buffer.fill(0);
          length = 0;
          return null;
      }

      if (b < 0x20) {
        return null;
      }
      if (length === buffer.length) {
        overflow = true;
        return null;
      }
      buffer[length++] = b;
      return null;
    }

    function finish(err) {
      if (finished) {
        return;
      }
      finished = true;

      stdin.removeListener('data', onData);
      stdin.removeListener('end', onEnd);
      stdin.removeListener('error', onError);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write('\n');

      if (!err && overflow) {
        err = tooLong();
      }
      if (err) {
        buffer.fill(0);
        reject(err);
        return;
      }

      const input = Buffer.alloc(length);
      buffer.copy(input, 0, 0, length);
      buffer.fill(0);
      resolve(input);
    }

    function onData(chunk) {
      let action = null;
      try {
        for (let i = 0; i < chunk.length && !action; i++) {
          action = handleByte(chunk[i]);
        }
      } catch (err) {
        action = err;
      } finally {
        if (Buffer.isBuffer(chunk)) {
          chunk.fill(0);
        }
      }

      if (action === SUBMIT) {
        finish(null);
      } else if (action === CANCEL) {
        finish(new PromptCancelled());
      } else if (action) {
        finish(action);
      }
    }

    function onEnd() {
      finish(null);
    }

    function onError(err) {
      finish(err);
    }

    stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.on('data', onData);
    stdin.on('end', onEnd);
    stdin.on('error', onError);
    stdin.resume();
  });
}

/**
 * Reads a secret from `stdin`: to its end when it's piped or redirected, or
 * from a no-echo prompt, written to `stderr`, when it's a terminal. Resolves to
 * a Buffer, which the caller zeroes. Rejects with a SecretInputError when the
 * input is too long, or a PromptCancelled on Ctrl-C at the prompt.
 */
function readSecret(options) {
  const stdin = options.stdin;

  if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
    return readTerminal(stdin, options.stderr, options.prompt);
  }
  return readStream(stdin);
}

module.exports = {
  readSecret,
  SecretInputError,
  PromptCancelled,
  MAX_INPUT_BYTES,
};
