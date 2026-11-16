/* globals describe */
/* globals it */
/* globals beforeEach */

const expect = require('chai').expect;
const yargs = require('yargs');
const EventEmitter = require('events');

const Command = require('../../src/token/command');
const { MAX_INPUT_BYTES } = require('../../src/token/read-secret');
const { expectNoPartOf, collector } = require('./helpers');

const TOKEN = '0123456789abcdef0123456789abcdef';
const PUBLIC_ID = '0372a8619ebcbbcd91abcda1ba389ac3';

function argv(extra) {
  return Object.assign({ _: ['token-public-id'], $0: 'rollbar-cli' }, extra);
}

describe('token-public-id Command()', function() {
  it('returns help output', async () => {
    const parser = yargs.command(Command).help();

    const result = await new Promise((resolve) => {
      parser.parse('token-public-id --help', (_err, _argv, output) => {
        resolve(output);
      });
    });

    expect(result).to.have.string('token-public-id');
    expect(result).to.have.string('Nothing is sent over the network.');
  });

  it('returns help output for -h', async () => {
    const parser = yargs.command(Command).help();

    const result = await new Promise((resolve) => {
      parser.parse('token-public-id -h', (_err, _argv, output) => {
        resolve(output);
      });
    });

    expect(result).to.have.string('-h, --help');
  });

  describe('run()', function() {
    beforeEach(function() {
      this.stdin = new EventEmitter();
      this.stdin.destroy = function () {};
      this.io = { stdin: this.stdin, stdout: collector(), stderr: collector() };
      this.pipe = (text) => {
        this.stdin.emit('data', Buffer.from(text));
        this.stdin.emit('end');
      };
    });

    it('prints the public ID alone on stdout', async function() {
      const code = Command.run(argv(), this.io);
      this.pipe(`${TOKEN}\n`);

      expect(await code).to.equal(0);
      expect(this.io.stdout.text).to.equal(`${PUBLIC_ID}\n`);
      expect(this.io.stderr.text).to.equal('');
    });

    it('prints warnings on stderr', async function() {
      const code = Command.run(argv(), this.io);
      this.pipe(` ${TOKEN.toUpperCase()}`);

      expect(await code).to.equal(0);
      expect(this.io.stdout.text).to.equal(`${PUBLIC_ID}\n`);
      expect(this.io.stderr.text).to.have.string('Warning: Ignored 1 whitespace character');
      expect(this.io.stderr.text).to.have.string('Warning: The token has uppercase letters');
    });

    it('prints the token type on stderr when verbose', async function() {
      const code = Command.run(argv({ v: true, verbose: true }), this.io);
      this.pipe(TOKEN);

      expect(await code).to.equal(0);
      expect(this.io.stderr.text).to.equal('Token type: legacy or v1\n');
    });

    it('prints neither warnings nor the token type when quiet', async function() {
      const code = Command.run(argv({ q: true, quiet: true, v: true, verbose: true }), this.io);
      this.pipe(` ${TOKEN.toUpperCase()}`);

      expect(await code).to.equal(0);
      expect(this.io.stdout.text).to.equal(`${PUBLIC_ID}\n`);
      expect(this.io.stderr.text).to.equal('');
    });

    it('prints errors when quiet', async function() {
      const code = Command.run(argv({ q: true, quiet: true }), this.io);
      this.pipe(`"${TOKEN}"`);

      expect(await code).to.equal(1);
      expect(this.io.stderr.text).to.have.string('character 1: quote');
    });

    it('accepts the global options', async function() {
      const code = Command.run(argv({
        v: false, verbose: false, q: false, quiet: false, h: false, help: false, version: false
      }), this.io);
      this.pipe(TOKEN);

      expect(await code).to.equal(0);
      expect(this.io.stdout.text).to.equal(`${PUBLIC_ID}\n`);
    });

    describe('accepts the color options that chalk reads', function() {
      const cases = {
        '--color': { color: true },
        '--no-color': { color: false },
        '--color=256': { color: 256 },
        '--color=never': { color: 'never' },
        '--colors': { colors: true },
      };

      Object.keys(cases).forEach(function (name) {
        it(name, async function() {
          const code = Command.run(argv(cases[name]), this.io);
          this.pipe(TOKEN);

          expect(await code).to.equal(0);
          expect(this.io.stdout.text).to.equal(`${PUBLIC_ID}\n`);
        });
      });
    });

    it('prints why the input isn\'t a token', async function() {
      const code = Command.run(argv(), this.io);
      this.pipe(`"${TOKEN}"`);

      expect(await code).to.equal(1);
      expect(this.io.stdout.text).to.equal('');
      expect(this.io.stderr.text).to.have.string('character 1: quote');
      expectNoPartOf(this.io.stderr.text, TOKEN);
    });

    it('exits with 130 when the prompt is cancelled', async function() {
      this.stdin.isTTY = true;
      this.stdin.setRawMode = function () {};
      this.stdin.resume = function () {};
      this.stdin.pause = function () {};

      const code = Command.run(argv(), this.io);
      this.stdin.emit('data', Buffer.from('abc\x03'));

      expect(await code).to.equal(130);
      expect(this.io.stdout.text).to.equal('');
      expect(this.io.stderr.text).to.have.string('Rollbar access token: \n');
      expect(this.io.stderr.text).to.have.string('Cancelled.');
    });

    it('prints only the code of an unexpected error, not its message', async function() {
      const code = Command.run(argv(), this.io);
      const error = new Error(`read ${TOKEN}`);
      error.code = 'EIO';
      this.stdin.emit('error', error);

      expect(await code).to.equal(1);
      expect(this.io.stderr.text).to.have.string('Couldn\'t read the access token (EIO).');
      expectNoPartOf(this.io.stderr.text, TOKEN);
    });

    it('prints nothing of an unexpected error without a code', async function() {
      const code = Command.run(argv(), this.io);
      this.stdin.emit('error', new Error(TOKEN));

      expect(await code).to.equal(1);
      expect(this.io.stderr.text).to.have.string('Couldn\'t read the access token.');
      expectNoPartOf(this.io.stderr.text, TOKEN);
    });

    it('prints the message of an error that is safe to show', async function() {
      const code = Command.run(argv(), this.io);
      this.stdin.emit('data', Buffer.alloc(MAX_INPUT_BYTES + 1, 0x61));

      expect(await code).to.equal(1);
      expect(this.io.stderr.text).to.have.string('too long to be an access token');
    });

    describe('refuses a token on the command line', function() {
      const cases = {
        'as a positional argument': argv({ _: ['token-public-id', TOKEN] }),
        'as --access-token': argv({ 'access-token': TOKEN, accessToken: TOKEN }),
        'as --token': argv({ token: TOKEN }),
        'as an option name': argv({ [TOKEN]: true }),
        'in uppercase': argv({ _: ['token-public-id', TOKEN.toUpperCase()] }),
        'as the value of --color': argv({ color: TOKEN }),
        'as the value of a flag': argv({ v: TOKEN, verbose: TOKEN }),
      };

      Object.keys(cases).forEach(function (name) {
        it(name, async function() {
          const code = await Command.run(cases[name], this.io);

          expect(code).to.equal(1);
          expect(this.stdin.listenerCount('data')).to.equal(0);
          expect(this.io.stdout.text).to.equal('');
          expect(this.io.stderr.text).to.have.string('takes no arguments');
          expect(this.io.stderr.text).to.have.string('consider rotating it');
          expectNoPartOf(this.io.stderr.text, TOKEN);
          expectNoPartOf(this.io.stderr.text, TOKEN.toUpperCase());
        });
      });
    });

    describe('refuses other arguments without suggesting rotating a token', function() {
      const cases = {
        'a positional argument': argv({ _: ['token-public-id', 'abc'] }),
        'a misspelled option': argv({ verbse: true }),
        'an option with a short hex value': argv({ token: 'deadbeef' }),
        'a color value chalk doesn\'t take': argv({ color: 'blue' }),
      };

      Object.keys(cases).forEach(function (name) {
        it(name, async function() {
          const code = await Command.run(cases[name], this.io);

          expect(code).to.equal(1);
          expect(this.stdin.listenerCount('data')).to.equal(0);
          expect(this.io.stderr.text).to.have.string('takes no arguments');
          expect(this.io.stderr.text).to.have.string('Pipe the token to stdin');
          expect(this.io.stderr.text).not.to.have.string('rotating');
        });
      });
    });
  });
});
