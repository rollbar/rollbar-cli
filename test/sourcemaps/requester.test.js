/* globals describe */
/* globals it */
/* globals beforeEach */

const expect = require('chai').expect;
const sinon = require('sinon');
const fs = require('fs')
const path = require('path');

const Requester = require('../../src/sourcemaps/requester');
const Scanner = require('../../src/sourcemaps/scanner');
const Output = require('../../src/common/output');

describe('Requester()', function() {
  it('should initialize successfully', function() {
    const options = {
      accessToken: 'abcd',
      baseUrl: 'https://example.com',
      codeVersion: '123'
    };
    const requester = new Requester(options);

    expect(requester.baseUrl).to.equal(options.baseUrl);
    expect(requester.version).to.equal(options.codeVersion);
    expect(requester.data).to.be.null;
    expect(requester).to.have.property('rollbarAPI');
    expect(requester.rollbarAPI.accessToken).to.equal(options.accessToken);
  });
});

describe('.requestSignedUrl()', function() {
  beforeEach(function() {
    global.output = new Output({quiet: true});
  });

  it('should upload successfully', async function() {
    const scannerOptions = {
      targetPath: './test/fixtures/builds/react16/build',
      sources: true
    };
    const scanner = new Scanner(scannerOptions);
    await scanner.scan();

    const options = {
      accessToken: 'abcd',
      baseUrl: 'https://example.com',
      codeVersion: '123'
    };
    const requester = new Requester(options);
    const stub = sinon.stub(requester.rollbarAPI.axios, 'post');
    stub.resolves({
      status: 200,
      statusText: 'Success',
      data: { err: 0, result: { uuid: 'd4c7acef55bf4c9ea95e4fe9428a8287'}}
    });


    await requester.requestSignedUrl();

    expect(stub.callCount).to.equal(1);

    for (const file of scanner.files) {
      // For this test, all API calls should succeed.
      expect(file.errors).to.be.an('array').that.is.empty;
    }

    stub.restore();
  });

  it('should handle and report API errors', async function() {
    const scannerOptions = {
      targetPath: './test/fixtures/builds/react16/build',
      sources: true
    };
    const scanner = new Scanner(scannerOptions);
    await scanner.scan();

    const options = {
      accessToken: 'abcd',
      baseUrl: 'https://example.com',
      codeVersion: '123'
    };
    const requester = new Requester(options);
    const stub = sinon.stub(requester.rollbarAPI.axios, 'post');
    stub.resolves({
      status: 401,
      statusText: 'Unauthorized',
      data: { err: 1, message: 'invalid access token'}
    });

    await requester.requestSignedUrl();

    expect(stub.callCount).to.equal(1);

    expect(requester.data.message).to.have.string('invalid access token');

    stub.restore();
  });

  it('should create manifest file', function() {

    const options = {
      accessToken: 'abcd',
      baseUrl: 'https://example.com',
      codeVersion: '123',
    };
    const requester = new Requester(options);
    requester.setProjectID(1)
    const filePath = './test/fixtures/builds/react16/build'
    requester.createManifestFile(filePath)

    const outFile = path.join(filePath, 'manifest.json');
    const fileStats = fs.statSync(outFile);
    expect(fileStats['size']).to.not.equal(0);
  });
});

