/* globals describe */
/* globals it */
/* globals beforeEach */
/* globals afterEach */

const expect = require('chai').expect;

const Command = require('../../src/sourcemaps/command');
const Output = require('../../src/common/output');
const yargs = require('yargs');
const sinon = require('sinon');
const axios = require('axios');
const AdmZip = require('adm-zip');
const RollbarAPI = require('../../src/common/rollbar-api');

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

describe('.handler() with --next', function() {
  const signedUrl = 'https://storage.example.com/bundle.zip?signature=abc';
  const argv = {
    path: './test/fixtures/builds/angular9/dist/app',
    'access-token': '1234',
    'url-prefix': 'http://localhost:3000/',
    'code-version': 'angular9',
    next: true,
    quiet: true
  };

  afterEach(function() {
    sinon.restore();
  });

  it('requests a signed URL and uploads a zip of the manifest and maps', async function() {
    const request = sinon.stub(RollbarAPI.prototype, 'sigendURLsourcemaps').resolves({
      err: 0,
      result: { project_id: 42, signed_url: signedUrl }
    });
    const put = sinon.stub(axios, 'put').resolves({ status: 200 });

    await Command.handler(argv);

    expect(request.firstCall.args[0]).to.deep.equal({
      version: 'angular9',
      baseUrl: 'http://localhost:3000/'
    });
    expect(put.callCount).to.equal(1);
    expect(put.firstCall.args[0]).to.equal(signedUrl);

    const zip = new AdmZip(put.firstCall.args[1]);
    expect(zip.getEntries().map((entry) => entry.entryName)).to.have.members([
      'manifest.json',
      'main-es5.js.map',
      'polyfills-es5.js.map',
      'runtime-es5.js.map',
      'styles-es5.js.map',
      'vendor-es5.js.map'
    ]);
    expect(JSON.parse(zip.readAsText('manifest.json'))).to.deep.equal({
      projectID: 42,
      version: 'angular9',
      baseUrl: 'http://localhost:3000/'
    });
  });

  it('does not upload when the signed URL request fails', async function() {
    sinon.stub(RollbarAPI.prototype, 'sigendURLsourcemaps').resolves({
      err: 1,
      message: 'invalid access token'
    });
    const put = sinon.stub(axios, 'put');

    await Command.handler(argv);

    expect(put.called).to.be.false;
  });

  it('does not request or upload on a dry run', async function() {
    const request = sinon.stub(RollbarAPI.prototype, 'sigendURLsourcemaps');
    const put = sinon.stub(axios, 'put');

    await Command.handler(Object.assign({}, argv, { 'dry-run': true }));

    expect(request.called).to.be.false;
    expect(put.called).to.be.false;
  });
});
