'use strict';

const crypto = require('crypto');
const { SafeMessageError } = require('./errors');

// A Rollbar access token is one of two lengths of lowercase hex. Its public ID
// is derived the same way Rollbar derives it:
//
//   32 characters, legacy or v1: the first 32 hex digits of SHA-512(token)
//   96 characters, v2:           the token's first 32 characters; the other 64 are the secret
//
// Rollbar labels a 32-character token either legacy or v1, and the token alone
// doesn't say which.
//
// The token is a secret. It stays in Buffers, which are zeroed once used, and is
// never turned into a string, written out, or put in an error message. Error
// messages say what is wrong with the input (its length, and the position and
// kind of each character that isn't hex) without repeating any of it.

const LEGACY_OR_V1_LENGTH = 32;
const V2_LENGTH = 96;
const PUBLIC_ID_LENGTH = 32;
const MAX_LISTED_PROBLEMS = 10;

const LEGACY_OR_V1 = 'legacy or v1';
const V2 = 'v2';

const EXPECTED = `A Rollbar access token has 32 (${LEGACY_OR_V1}) or 96 (${V2}) hexadecimal characters (0-9, a-f).`;

// Characters that are invisible or look like ASCII, and so turn up in tokens
// copied from documents and chat. Any other non-ASCII character goes unnamed:
// the input might be some other secret, and its characters aren't repeated.
const NAMED_NON_ASCII = {
  0x00a0: 'no-break space',
  0x200b: 'zero-width space',
  0x200c: 'zero-width non-joiner',
  0x200d: 'zero-width joiner',
  0x2060: 'word joiner',
  0xfeff: 'byte order mark',
  0x2018: 'curly quote',
  0x2019: 'curly quote',
  0x201c: 'curly quote',
  0x201d: 'curly quote',
  0x2010: 'hyphen',
  0x2013: 'en dash',
  0x2014: 'em dash',
};

class TokenFormatError extends SafeMessageError {}

function isWhitespace(b) {
  return b === 0x20 || (b >= 0x09 && b <= 0x0d);
}

function isHexDigit(b) {
  return (b >= 0x30 && b <= 0x39) || (b >= 0x61 && b <= 0x66) || isUpperHexDigit(b);
}

function isUpperHexDigit(b) {
  return b >= 0x41 && b <= 0x46;
}

function isLetter(b) {
  return (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a);
}

function plural(n, singular, pluralForm = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

// Where the token starts and ends once surrounding ASCII whitespace is removed,
// and how much was removed. A single line ending after the token is what piping
// a file or `echo` adds, so it isn't counted.
function trim(input) {
  let start = 0;
  let end = input.length;

  while (start < end && isWhitespace(input[start])) {
    start++;
  }
  while (end > start && isWhitespace(input[end - 1])) {
    end--;
  }

  let trailing = input.length - end;
  if (trailing >= 2 && input[input.length - 2] === 0x0d && input[input.length - 1] === 0x0a) {
    trailing -= 2;
  } else if (trailing >= 1 && input[input.length - 1] === 0x0a) {
    trailing -= 1;
  }

  return { start, end, leading: start, trailing };
}

// The byte length of the UTF-8 sequence that starts with byte b.
function sequenceLength(b) {
  if (b >= 0xc0 && b <= 0xdf) return 2;
  if (b >= 0xe0 && b <= 0xef) return 3;
  if (b >= 0xf0 && b <= 0xf7) return 4;
  return 1;
}

// The byte length of the character at input[i]: its lead byte, and the
// continuation bytes (10xxxxxx) after it that its sequence calls for. It stops
// at a byte that can't continue the sequence, so a byte that isn't UTF-8, such
// as Latin-1, doesn't swallow the characters after it.
function characterLength(input, i, end) {
  const expected = sequenceLength(input[i]);
  let length = 1;
  while (length < expected && i + length < end && (input[i + length] & 0xc0) === 0x80) {
    length++;
  }
  return length;
}

function describeAscii(b) {
  if (b === 0x20) return 'space';
  if (b === 0x09) return 'tab';
  if (b === 0x0a || b === 0x0d) return 'line break';
  if (b < 0x20 || b === 0x7f) return 'control character';
  if (b === 0x22 || b === 0x27 || b === 0x60) return 'quote';
  if (isLetter(b)) return 'letter outside a-f';
  return 'punctuation';
}

function describeNonAscii(input, i, length) {
  const character = input.toString('utf8', i, i + length);
  const codePoint = character.codePointAt(0);

  if (length === 1 || codePoint === 0xfffd) {
    return 'byte that isn\'t valid UTF-8';
  }

  const name = NAMED_NON_ASCII[codePoint];
  const hex = codePoint.toString(16).toUpperCase().padStart(4, '0');
  return name ? `${name} (U+${hex})` : 'non-ASCII character';
}

// The input's length in characters, and the position and kind of each character
// that isn't a hex digit.
function inspect(input, start, end) {
  const problems = [];
  let characters = 0;
  let i = start;

  while (i < end) {
    const b = input[i];
    characters++;

    if (b < 0x80) {
      if (!isHexDigit(b)) {
        problems.push({ position: characters, description: describeAscii(b) });
      }
      i++;
    } else {
      const length = characterLength(input, i, end);
      problems.push({ position: characters, description: describeNonAscii(input, i, length) });
      i += length;
    }
  }

  return { characters, problems };
}

// How much whitespace was ignored, and where, as in "2 whitespace characters
// before the token and 1 after it".
function ignoredWhitespace(leading, trailing, what) {
  if (leading && trailing) {
    return `${plural(leading, 'whitespace character')} before ${what} and ${trailing} after it`;
  }
  if (leading) {
    return `${plural(leading, 'whitespace character')} before ${what}`;
  }
  return `${plural(trailing, 'whitespace character')} after ${what}`;
}

function formatError(input, start, end, leading, trailing) {
  const { characters, problems } = inspect(input, start, end);

  // The length and positions leave out the whitespace around the input, so say so.
  let length = `it has ${plural(characters, 'character')}`;
  if (leading || trailing) {
    length += ` (not counting ${ignoredWhitespace(leading, trailing, 'it')})`;
  }

  if (problems.length === 0) {
    return `Not a Rollbar access token: ${length}. ${EXPECTED}`;
  }

  const notHex = problems.length === 1 ? '1 of them isn\'t' : `${problems.length} of them aren't`;
  const lines = [
    `Not a Rollbar access token: ${length}, and ${notHex} hexadecimal. ${EXPECTED}`
  ];

  problems.slice(0, MAX_LISTED_PROBLEMS).forEach(function (problem) {
    lines.push(`  character ${problem.position}: ${problem.description}`);
  });
  if (problems.length > MAX_LISTED_PROBLEMS) {
    lines.push(`  and ${problems.length - MAX_LISTED_PROBLEMS} more`);
  }

  return lines.join('\n');
}

function whitespaceWarning(leading, trailing) {
  const they = leading + trailing === 1 ? 'it\'s' : 'they\'re';
  return `Ignored ${ignoredWhitespace(leading, trailing, 'the token')}. ` +
    `Rollbar may reject the token if ${they} part of the value you configured.`;
}

/**
 * Derives the public ID of the Rollbar access token in `input`, a Buffer.
 *
 * Returns { type, publicId, warnings }: type is 'legacy or v1' for a
 * 32-character token, or 'v2' for a 96-character one, and each warning is a
 * message about something in the input that Rollbar may reject.
 * Throws a TokenFormatError, whose message is safe to show, when the input isn't
 * a token. Never modifies `input`; the caller zeroes it.
 */
function publicIdFromToken(input) {
  const { start, end, leading, trailing } = trim(input);
  const length = end - start;

  if (length === 0) {
    throw new TokenFormatError(`No access token: the input is empty. ${EXPECTED}`);
  }

  let valid = length === LEGACY_OR_V1_LENGTH || length === V2_LENGTH;
  let uppercase = false;
  for (let i = start; valid && i < end; i++) {
    valid = isHexDigit(input[i]);
    uppercase = uppercase || isUpperHexDigit(input[i]);
  }

  if (!valid) {
    throw new TokenFormatError(formatError(input, start, end, leading, trailing));
  }

  // Rollbar issues tokens in lowercase, so the lowercase token is the one that
  // can exist.
  const token = Buffer.alloc(length);
  try {
    for (let i = 0; i < length; i++) {
      token[i] = input[start + i] | (isUpperHexDigit(input[start + i]) ? 0x20 : 0);
    }

    const warnings = [];
    if (leading || trailing) {
      warnings.push(whitespaceWarning(leading, trailing));
    }
    if (uppercase) {
      warnings.push('The token has uppercase letters, but Rollbar issues tokens in lowercase and may reject it as typed. This is the public ID of the lowercase token.');
    }

    if (length === LEGACY_OR_V1_LENGTH) {
      const hash = crypto.createHash('sha512').update(token).digest('hex');
      return { type: LEGACY_OR_V1, publicId: hash.slice(0, PUBLIC_ID_LENGTH), warnings };
    }

    return { type: V2, publicId: token.toString('ascii', 0, PUBLIC_ID_LENGTH), warnings };
  } finally {
    token.fill(0);
  }
}

module.exports = {
  publicIdFromToken,
  TokenFormatError,
};
