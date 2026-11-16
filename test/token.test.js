/* globals describe */
/* globals it */

const expect = require('chai').expect;
const path = require('path');
const spawnSync = require('child_process').spawnSync;

const { expectNoPartOf } = require('./token/no-leak');

const BIN = path.join(__dirname, '..', 'bin', 'rollbar');

const LEGACY = 'deadbeefdeadbeefdeadbeefdeadbeef';
const LEGACY_PUBLIC_ID = '4e9a6971bfc93a73ebe5df7071732c82';
const V2_PUBLIC_ID = '0123456789abcdef0123456789abcdef';
const V2_SECRET = 'fedcba9876543210'.repeat(4);

function run(args, input) {
  const result = spawnSync(process.execPath, [BIN, 'token-public-id'].concat(args), {
    input: input,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { FORCE_COLOR: '0' })
  });
  result.output = result.stdout + result.stderr;
  return result;
}

describe('rollbar-cli token-public-id', function() {
  this.timeout(10000);

  it('returns help output', function() {
    const result = run(['--help']);

    expect(result.status).to.equal(0);
    expect(result.stdout).to.have.string('token-public-id');
  });

  it('prints the public ID of a legacy token piped to stdin', function() {
    const result = run([], `${LEGACY}\n`);

    expect(result.status).to.equal(0);
    expect(result.stdout).to.equal(`${LEGACY_PUBLIC_ID}\n`);
    expect(result.stderr).to.equal('');
  });

  it('prints the public ID of a v2 token, and never its secret', function() {
    const result = run(['--verbose'], V2_PUBLIC_ID + V2_SECRET);

    expect(result.status).to.equal(0);
    expect(result.stdout).to.equal(`${V2_PUBLIC_ID}\n`);
    expect(result.stderr).to.equal('Token type: v2\n');
    expectNoPartOf(result.output, V2_SECRET);
  });

  it('fails without repeating input that isn\'t a token', function() {
    const result = run([], `${LEGACY}0\n`);

    expect(result.status).to.equal(1);
    expect(result.stdout).to.equal('');
    expect(result.stderr).to.have.string('it has 33 characters');
    expectNoPartOf(result.output, LEGACY);
  });

  it('fails when stdin is empty', function() {
    const result = run([], '');

    expect(result.status).to.equal(1);
    expect(result.stderr).to.have.string('the input is empty');
  });

  const onCommandLine = {
    'as --access-token': ['--access-token', LEGACY],
    'as --access-token=': [`--access-token=${LEGACY}`],
    'as --token': ['--token', LEGACY],
    'as a positional argument': [LEGACY],
    'after --': ['--', LEGACY],
  };

  Object.keys(onCommandLine).forEach(function (name) {
    it(`refuses a token on the command line ${name}`, function() {
      const result = run(onCommandLine[name], `${LEGACY}\n`);

      expect(result.status).to.equal(1);
      expect(result.stdout).to.equal('');
      expect(result.stderr).to.have.string('takes no arguments');
      expectNoPartOf(result.output, LEGACY);
    });
  });
});
