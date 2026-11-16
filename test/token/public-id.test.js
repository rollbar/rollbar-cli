/* globals describe */
/* globals it */

const expect = require('chai').expect;

const { publicIdFromToken, TokenFormatError } = require('../../src/token/public-id');
const { expectNoPartOf } = require('./helpers');

// Patterned tokens, not random ones, so that secret scanners don't take them for
// real. Each expected public ID is from `printf %s <token> | shasum -a 512 | cut -c1-32`,
// not from the code under test.
const LEGACY = {
  'cccccccccccccccccccccccccccccccc': '7308948d99219c5d1dca24f1fc07aad9',
  '0123456789abcdef0123456789abcdef': '0372a8619ebcbbcd91abcda1ba389ac3',
  'deadbeefdeadbeefdeadbeefdeadbeef': '4e9a6971bfc93a73ebe5df7071732c82',
};
const V2_PUBLIC_ID = '0123456789abcdef0123456789abcdef';
const V2_SECRET = 'fedcba9876543210'.repeat(4);
const V2 = V2_PUBLIC_ID + V2_SECRET;
const TOKEN = '0123456789abcdef0123456789abcdef';

function derive(text) {
  return publicIdFromToken(Buffer.from(text));
}

function errorFor(input) {
  try {
    publicIdFromToken(Buffer.isBuffer(input) ? input : Buffer.from(input));
  } catch (err) {
    expect(err).to.be.an.instanceOf(TokenFormatError);
    return err.message;
  }
  throw new Error('expected a TokenFormatError');
}

describe('publicIdFromToken()', function() {
  describe('a legacy or v1 token', function() {
    Object.keys(LEGACY).forEach(function (token) {
      it(`is the start of the SHA-512 of ${token.slice(0, 8)}...`, function() {
        expect(derive(token)).to.deep.equal({ type: 'legacy or v1', publicId: LEGACY[token], warnings: [] });
      });
    });

    it('is derived from the lowercase token when it has uppercase letters', function() {
      const result = derive('DEADBEEFdeadbeefDEADBEEFdeadbeef');

      expect(result.publicId).to.equal(LEGACY.deadbeefdeadbeefdeadbeefdeadbeef);
      // As typed, it would be 5bb08e3a25df9e32b73e8e289a77cf56.
      expect(result.warnings).to.have.lengthOf(1);
      expect(result.warnings[0]).to.have.string('uppercase');
      expect(result.warnings[0]).to.have.string('lowercase token');
    });
  });

  describe('a v2 token', function() {
    it('is its first 32 characters', function() {
      expect(derive(V2)).to.deep.equal({ type: 'v2', publicId: V2_PUBLIC_ID, warnings: [] });
    });

    it('is lowercase when the token has uppercase letters', function() {
      const result = derive(V2.toUpperCase());

      expect(result.publicId).to.equal(V2_PUBLIC_ID);
      expect(result.warnings[0]).to.have.string('uppercase');
    });
  });

  it('leaves the input as it was', function() {
    const input = Buffer.from(` ${TOKEN.toUpperCase()}\n`);
    const copy = Buffer.from(input);

    derive(input);

    expect(input.equals(copy)).to.equal(true);
  });

  describe('whitespace around the token', function() {
    it('is ignored without a warning when it is a single line ending', function() {
      expect(derive(`${TOKEN}\n`).warnings).to.deep.equal([]);
      expect(derive(`${TOKEN}\r\n`).warnings).to.deep.equal([]);
    });

    it('is ignored with a warning that counts it before and after', function() {
      const result = derive(` \t${TOKEN} \n`);

      expect(result.publicId).to.equal(LEGACY[TOKEN]);
      expect(result.warnings).to.deep.equal([
        'Ignored 2 whitespace characters before the token and 1 after it. ' +
        'Rollbar may reject the token if they\'re part of the value you configured.'
      ]);
    });

    it('is described in the singular when there is one character', function() {
      expect(derive(`${TOKEN} `).warnings).to.deep.equal([
        'Ignored 1 whitespace character after the token. ' +
        'Rollbar may reject the token if it\'s part of the value you configured.'
      ]);
      expect(derive(` ${TOKEN}`).warnings[0]).to.have.string('Ignored 1 whitespace character before the token.');
    });

    it('comes before the uppercase warning', function() {
      const warnings = derive(` ${TOKEN.toUpperCase()}`).warnings;

      expect(warnings).to.have.lengthOf(2);
      expect(warnings[0]).to.have.string('whitespace');
      expect(warnings[1]).to.have.string('uppercase');
    });
  });

  describe('input that is not a token', function() {
    it('is empty', function() {
      expect(errorFor('')).to.have.string('the input is empty');
      expect(errorFor(' \n\t\r\n')).to.have.string('the input is empty');
    });

    it('is hex of the wrong length', function() {
      expect(errorFor(TOKEN + 'a')).to.equal(
        'Not a Rollbar access token: it has 33 characters. ' +
        'A Rollbar access token has 32 (legacy or v1) or 96 (v2) hexadecimal characters (0-9, a-f).'
      );
      expect(errorFor('a')).to.have.string('it has 1 character.');
    });

    it('has characters that are not hex, listed by position and kind', function() {
      expect(errorFor(`"${TOKEN}"`)).to.equal(
        'Not a Rollbar access token: it has 34 characters, and 2 of them aren\'t hexadecimal. ' +
        'A Rollbar access token has 32 (legacy or v1) or 96 (v2) hexadecimal characters (0-9, a-f).\n' +
        '  character 1: quote\n' +
        '  character 34: quote'
      );
    });

    it('has one character that is not hex', function() {
      const message = errorFor(TOKEN.slice(0, 31) + 'g');

      expect(message).to.have.string('it has 32 characters, and 1 of them isn\'t hexadecimal.');
      expect(message).to.have.string('character 32: letter outside a-f');
    });

    it('describes each kind of ASCII character', function() {
      const message = errorFor(`'${TOKEN.slice(0, 8)} \t\r\n\x01\x7fz:-`);

      expect(message).to.have.string('character 1: quote\n');
      expect(message).to.have.string('character 10: space\n');
      expect(message).to.have.string('character 11: tab\n');
      expect(message).to.have.string('character 12: line break\n');
      expect(message).to.have.string('character 13: line break\n');
      expect(message).to.have.string('character 14: control character\n');
      expect(message).to.have.string('character 15: control character\n');
      expect(message).to.have.string('character 16: letter outside a-f\n');
      expect(message).to.have.string('character 17: punctuation\n');
      expect(message).to.have.string('character 18: punctuation');
      expect(errorFor(`\`${TOKEN}`)).to.have.string('character 1: quote');
    });

    it('names invisible and look-alike characters', function() {
      const names = {
        '\u00a0': 'no-break space (U+00A0)',
        '\u200b': 'zero-width space (U+200B)',
        '\u200c': 'zero-width non-joiner (U+200C)',
        '\u200d': 'zero-width joiner (U+200D)',
        '\u2060': 'word joiner (U+2060)',
        '\ufeff': 'byte order mark (U+FEFF)',
        '\u2018': 'curly quote (U+2018)',
        '\u2019': 'curly quote (U+2019)',
        '\u201c': 'curly quote (U+201C)',
        '\u201d': 'curly quote (U+201D)',
        '\u2010': 'hyphen (U+2010)',
        '\u2013': 'en dash (U+2013)',
        '\u2014': 'em dash (U+2014)',
      };

      Object.keys(names).forEach(function (character) {
        expect(errorFor(TOKEN + character)).to.have.string(`character 33: ${names[character]}`);
      });
      expect(errorFor(`\ufeff${TOKEN}`)).to.have.string('character 1: byte order mark (U+FEFF)');
    });

    it('doesn\'t name other non-ASCII characters', function() {
      const message = errorFor(`${TOKEN}\u00e9\u{1f600}`);

      expect(message).to.have.string('it has 34 characters');
      expect(message).to.have.string('character 33: non-ASCII character\n');
      expect(message).to.have.string('character 34: non-ASCII character');
      expect(message).not.to.have.string('U+');
    });

    it('describes bytes that aren\'t UTF-8', function() {
      const message = errorFor(Buffer.concat([Buffer.from(TOKEN), Buffer.from([0xff, 0xe2, 0x80])]));

      expect(message).to.have.string('character 33: byte that isn\'t valid UTF-8\n');
      expect(message).to.have.string('character 34: byte that isn\'t valid UTF-8');
    });

    it('counts a byte that isn\'t UTF-8 as one character, without the ones after it', function() {
      const latin1 = errorFor(Buffer.concat([Buffer.from([0xe9]), Buffer.from(TOKEN)]));

      expect(latin1).to.have.string('it has 33 characters, and 1 of them isn\'t hexadecimal.');
      expect(latin1).to.have.string('character 1: byte that isn\'t valid UTF-8');

      const inside = errorFor(Buffer.concat([
        Buffer.from(TOKEN.slice(0, 10)), Buffer.from([0xe2, 0x80]), Buffer.from(TOKEN.slice(10))
      ]));

      expect(inside).to.have.string('it has 33 characters, and 1 of them isn\'t hexadecimal.');
      expect(inside).to.have.string('character 11: byte that isn\'t valid UTF-8');
    });

    it('says how much whitespace around it the length and positions leave out', function() {
      expect(errorFor(`  "${TOKEN}" \n`)).to.have.string(
        'it has 34 characters (not counting 2 whitespace characters before it and 1 after it), ' +
        'and 2 of them aren\'t hexadecimal.'
      );
      expect(errorFor(`  "${TOKEN}"`)).to.have.string('character 1: quote');
      expect(errorFor(` ${TOKEN}a`)).to.have.string('it has 33 characters (not counting 1 whitespace character before it).');
      expect(errorFor(`${TOKEN}a\t`)).to.have.string('it has 33 characters (not counting 1 whitespace character after it).');
      expect(errorFor(`${TOKEN}a\n`)).to.have.string('it has 33 characters.');
    });

    it('lists at most ten characters', function() {
      const message = errorFor('z'.repeat(32));

      expect(message).to.have.string('character 10: letter outside a-f\n  and 22 more');
      expect(message).not.to.have.string('character 11');
    });

    it('is never repeated in the error', function() {
      const inputs = [
        TOKEN + 'a',
        `"${TOKEN}"`,
        `${TOKEN.slice(0, 16)} ${TOKEN.slice(16)}`,
        `${V2.slice(0, 95)}z`,
        `12345:${TOKEN}`,
        `\ufeff${TOKEN}`,
      ];

      inputs.forEach(function (input) {
        expectNoPartOf(errorFor(input), TOKEN);
      });
      expectNoPartOf(errorFor(`${V2.slice(0, 95)}z`), V2_SECRET);
    });
  });
});
