'use strict';

const crypto = require('crypto');

// A Rollbar access token is one of two lengths of lowercase hex. Its public ID
// is derived the same way Rollbar derives it:
//
//   legacy, 32 characters: the first 32 hex digits of SHA-512(token)
//   v2, 96 characters:     the token's first 32 characters; the other 64 are the secret
//
// The token is a secret. It stays in Buffers, which are zeroed once used, and is
// never turned into a string, written out, or put in an error message. Error
// messages say what is wrong with the input (its length, and the position and
// kind of each character that isn't hex) without repeating any of it.

const LEGACY_LENGTH = 32;
const V2_LENGTH = 96;
const PUBLIC_ID_LENGTH = 32;
const MAX_LISTED_PROBLEMS = 10;

const EXPECTED = 'A Rollbar access token has 32 (legacy) or 96 (v2) hexadecimal characters (0-9, a-f).';

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

class TokenFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenFormatError';
  }
}

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

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
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
      const length = Math.min(sequenceLength(b), end - i);
      problems.push({ position: characters, description: describeNonAscii(input, i, length) });
      i += length;
    }
  }

  return { characters, problems };
}

function formatError(input, start, end) {
  const { characters, problems } = inspect(input, start, end);

  if (problems.length === 0) {
    return `Not a Rollbar access token: it has ${plural(characters, 'character')}. ${EXPECTED}`;
  }

  const notHex = problems.length === 1 ? '1 of them isn\'t' : `${problems.length} of them aren't`;
  const lines = [
    `Not a Rollbar access token: it has ${plural(characters, 'character')}, and ${notHex} hexadecimal. ${EXPECTED}`
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
  let where;
  if (leading && trailing) {
    where = `${plural(leading, 'whitespace character')} before the token and ${trailing} after it`;
  } else if (leading) {
    where = `${plural(leading, 'whitespace character')} before the token`;
  } else {
    where = `${plural(trailing, 'whitespace character')} after the token`;
  }

  const they = leading + trailing === 1 ? 'it\'s' : 'they\'re';
  return `Ignored ${where}. Rollbar may reject the token if ${they} part of the value you configured.`;
}

/**
 * Derives the public ID of the Rollbar access token in `input`, a Buffer.
 *
 * Returns { type, publicId, warnings }: type is 'legacy' or 'v2', and each
 * warning is a message about something in the input that Rollbar may reject.
 * Throws a TokenFormatError, whose message is safe to show, when the input isn't
 * a token. Never modifies `input`; the caller zeroes it.
 */
function publicIdFromToken(input) {
  const { start, end, leading, trailing } = trim(input);
  const length = end - start;

  if (length === 0) {
    throw new TokenFormatError(`No access token: the input is empty. ${EXPECTED}`);
  }

  let valid = length === LEGACY_LENGTH || length === V2_LENGTH;
  let uppercase = false;
  for (let i = start; valid && i < end; i++) {
    valid = isHexDigit(input[i]);
    uppercase = uppercase || isUpperHexDigit(input[i]);
  }

  if (!valid) {
    throw new TokenFormatError(formatError(input, start, end));
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

    if (length === LEGACY_LENGTH) {
      const hash = crypto.createHash('sha512').update(token).digest('hex');
      return { type: 'legacy', publicId: hash.slice(0, PUBLIC_ID_LENGTH), warnings };
    }

    return { type: 'v2', publicId: token.toString('ascii', 0, PUBLIC_ID_LENGTH), warnings };
  } finally {
    token.fill(0);
  }
}

module.exports = {
  publicIdFromToken,
  TokenFormatError,
};
