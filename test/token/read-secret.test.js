/* globals describe */
/* globals it */
/* globals beforeEach */

const expect = require('chai').expect;
const sinon = require('sinon');
const EventEmitter = require('events');

const {
  readSecret,
  SecretInputError,
  PromptCancelled,
  MAX_INPUT_BYTES
} = require('../../src/token/read-secret');

const { collector } = require('./helpers');

const PROMPT = 'Token: ';

function pipe() {
  const stdin = new EventEmitter();
  stdin.destroy = sinon.spy();
  return stdin;
}

function terminal() {
  const stdin = new EventEmitter();
  stdin.isTTY = true;
  stdin.setRawMode = sinon.spy();
  stdin.resume = sinon.spy();
  stdin.pause = sinon.spy();
  return stdin;
}

function isZeroed(buffer) {
  return buffer.every(function (b) { return b === 0; });
}

describe('readSecret()', function() {
  describe('from a pipe', function() {
    beforeEach(function() {
      this.stdin = pipe();
      this.stderr = collector();
      this.read = readSecret({ stdin: this.stdin, stderr: this.stderr, prompt: PROMPT });
    });

    it('reads every chunk, zeroes them, and writes no prompt', async function() {
      const chunks = [Buffer.from('abc'), Buffer.from('def\n')];
      chunks.forEach((chunk) => this.stdin.emit('data', chunk));
      this.stdin.emit('end');

      const input = await this.read;

      expect(input.toString()).to.equal('abcdef\n');
      expect(chunks.every(isZeroed)).to.equal(true);
      expect(this.stderr.text).to.equal('');
      expect(this.stdin.listenerCount('data')).to.equal(0);
    });

    it('reads string chunks', async function() {
      this.stdin.emit('data', 'abc');
      this.stdin.emit('end');

      expect((await this.read).toString()).to.equal('abc');
    });

    it('reads nothing', async function() {
      this.stdin.emit('end');

      expect((await this.read).length).to.equal(0);
    });

    it('stops reading input that is too long', async function() {
      const chunk = Buffer.alloc(MAX_INPUT_BYTES + 1, 0x61);
      this.stdin.emit('data', chunk);

      const err = await this.read.then(() => null, (e) => e);

      expect(err).to.be.an.instanceOf(SecretInputError);
      expect(err.message).to.equal('The input is longer than 1024 bytes, too long to be an access token.');
      expect(isZeroed(chunk)).to.equal(true);
      expect(this.stdin.destroy.calledOnce).to.equal(true);
    });

    it('passes on a stream error', async function() {
      const chunk = Buffer.from('abc');
      const error = new Error('EIO');
      this.stdin.emit('data', chunk);
      this.stdin.emit('error', error);

      expect(await this.read.then(() => null, (e) => e)).to.equal(error);
      expect(isZeroed(chunk)).to.equal(true);
    });
  });

  describe('from a terminal', function() {
    beforeEach(function() {
      this.stdin = terminal();
      this.stderr = collector();
      this.read = readSecret({ stdin: this.stdin, stderr: this.stderr, prompt: PROMPT });
      this.type = (bytes) => {
        const chunk = Buffer.from(bytes);
        this.stdin.emit('data', chunk);
        return chunk;
      };
    });

    function expectRestored(test) {
      expect(test.stdin.setRawMode.args).to.deep.equal([[true], [false]]);
      expect(test.stdin.pause.calledOnce).to.equal(true);
      expect(test.stdin.listenerCount('data')).to.equal(0);
      expect(test.stderr.text).to.equal(`${PROMPT}\n`);
    }

    it('reads to Enter without echoing anything, and zeroes what it read', async function() {
      expect(this.stderr.text).to.equal(PROMPT);
      expect(this.stdin.setRawMode.args).to.deep.equal([[true]]);
      expect(this.stdin.resume.calledOnce).to.equal(true);

      const chunks = [this.type('abc'), this.type('def\rghi')];
      const input = await this.read;

      expect(input.toString()).to.equal('abcdef');
      expect(chunks.every(isZeroed)).to.equal(true);
      expectRestored(this);
    });

    it('ends at a line feed or Ctrl-D too', async function() {
      this.type('abc\n');
      expect((await this.read).toString()).to.equal('abc');

      const stdin = terminal();
      const read = readSecret({ stdin, stderr: collector(), prompt: PROMPT });
      stdin.emit('data', Buffer.from('def\x04'));
      expect((await read).toString()).to.equal('def');
    });

    it('erases a character with Backspace, including a multi-byte one', async function() {
      this.type('abx\x7fc\u00e9\x08\x7fd\x7f\x7f\x7f\x7fe\r');

      expect((await this.read).toString()).to.equal('e');
    });

    it('clears the line with Ctrl-U', async function() {
      this.type('abc\x15de\r');

      expect((await this.read).toString()).to.equal('de');
    });

    it('ignores escape sequences and other control characters', async function() {
      this.type('a\x1b[Db\x1b[1;5Cc\x1bOAd\x1bxe\tf\x00\r');

      expect((await this.read).toString()).to.equal('abcdef');
    });

    it('handles a control character after a lone Esc', async function() {
      this.type('ab\x1b\x7fc\x1b[\x15de\x1b\r');

      expect((await this.read).toString()).to.equal('de');
    });

    it('is cancelled by Ctrl-C after a lone Esc', async function() {
      this.type('abc\x1b\x03');

      const err = await this.read.then(() => null, (e) => e);

      expect(err).to.be.an.instanceOf(PromptCancelled);
      expectRestored(this);
    });

    it('is cancelled by Ctrl-C', async function() {
      const chunk = this.type('abc\x03def');

      const err = await this.read.then(() => null, (e) => e);

      expect(err).to.be.an.instanceOf(PromptCancelled);
      expect(isZeroed(chunk)).to.equal(true);
      expectRestored(this);
    });

    it('rejects input that is too long', async function() {
      this.type('a'.repeat(MAX_INPUT_BYTES + 1) + '\r');

      const err = await this.read.then(() => null, (e) => e);

      expect(err).to.be.an.instanceOf(SecretInputError);
      expectRestored(this);
    });

    it('reads what was typed when the input ends', async function() {
      this.type('abc');
      this.stdin.emit('end');

      expect((await this.read).toString()).to.equal('abc');
      expectRestored(this);
    });

    it('passes on a stream error', async function() {
      const error = new Error('EIO');
      this.type('abc');
      this.stdin.emit('error', error);

      expect(await this.read.then(() => null, (e) => e)).to.equal(error);
      expectRestored(this);
    });

    it('finishes once', async function() {
      this.type('abc\r');
      this.stdin.emit('data', Buffer.from('\r'));

      await this.read;

      expect(this.stdin.setRawMode.callCount).to.equal(2);
    });
  });
});
