/* globals describe */
/* globals it */
/* globals beforeEach */
/* globals afterEach */

const expect = require('chai').expect;

const Command = require('../../src/sourcemaps/command');
const Output = require('../../src/common/output');
const yargs = require('yargs');
const sinon = require('sinon');

describe('Command()', function() {
  beforeEach(function() {
    global.output = new Output({verbose: false});
    this.currentTest.stubWarn = sinon.spy(global.output, 'warn');
    this.currentTest.stubSuccess = sinon.spy(global.output, 'success');
  });

  afterEach(function() {
    //global.output = null;
    this.currentTest.stubWarn.restore();
    this.currentTest.stubSuccess.restore();
  });

  it('returns help output', async () => {
    const parser = yargs.command(Command).help();

    const result = await new Promise((resolve) => {
      parser.parse('--help', (_err, _argv, output) => {
        resolve(output);
      })
    });

    expect(result).to.have.string('upload-sourcemaps <path> [options]');
  });

  // This test is skipped because there's an issue using yargs parse() with Promises.
  // https://github.com/yargs/yargs/issues/1069
  //
  // It is kept in the code because when there is a fix, this will be a useful
  // test pattern since the different output calls can be separately spied and verified.
  it.skip('scans, loads and validates react project', async function() {
    this.timeout(5000);
    const stubWarn = this.test.stubWarn;
    const stubSuccess = this.test.stubSuccess;

    const parser = yargs.command(Command).help();
    await new Promise((resolve) => {
      parser.parse('upload-sourcemaps ./test/fixtures/builds/react16/build --access-token 1234 --url-prefix "http://localhost:3000/" --code-version react16 -D', (_err, _argv, output) => {
        resolve(output);
      })
    });

    expect(stubWarn.callCount).to.equal(2);
    expect(stubSuccess.callCount).to.equal(3);
  });
});
