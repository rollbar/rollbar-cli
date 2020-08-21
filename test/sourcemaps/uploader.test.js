/* globals describe */
/* globals it */
/* globals beforeEach */

const expect = require('chai').expect;
const sinon = require('sinon');

const Uploader = require('../../src/sourcemaps/uploader');
const Scanner = require('../../src/sourcemaps/scanner');
const Output = require('../../src/common/output');

describe('Uploader()', function() {
  it('should initialize successfully', function() {
    const options = {
      accessToken: 'abcd',
      baseUrl: 'https://example.com',
      codeVersion: '123'
    };
    const uploader = new Uploader(options);

    expect(uploader.baseUrl).to.equal(options.baseUrl);
    expect(uploader.version).to.equal(options.codeVersion);
    expect(uploader.files).to.be.an('array').that.is.empty;
    expect(uploader).to.have.property('rollbarAPI');
    expect(uploader.rollbarAPI.accessToken).to.equal(options.accessToken);
  });
});

describe('.upload()', function() {
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
    const files = scanner.mappedFiles();

    const options = {
      accessToken: 'abcd',
      baseUrl: 'https://example.com',
      codeVersion: '123'
    };
    const uploader = new Uploader(options);
    const stub = sinon.stub(uploader.rollbarAPI.axios, 'post');
    stub.resolves({
      status: 200,
      statusText: 'Success',
      data: { err: 0, result: { uuid: 'd4c7acef55bf4c9ea95e4fe9428a8287'}}
    });

    uploader.mapFiles(files);

    await uploader.upload();

    // For the input data that was scanned, we expect a total of 5 js files,
    // but only 3 have source maps. Therefore we expect only 3 API calls.
    expect(stub.callCount).to.equal(3);

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
    const files = scanner.mappedFiles();

    const options = {
      accessToken: 'abcd',
      baseUrl: 'https://example.com',
      codeVersion: '123'
    };
    const uploader = new Uploader(options);
    const stub = sinon.stub(uploader.rollbarAPI.axios, 'post');
    stub.resolves({
      status: 401,
      statusText: 'Unauthorized',
      data: { err: 1, message: 'invalid access token'}
    });

    uploader.mapFiles(files);

    await uploader.upload();

    // For the input data that was scanned, we expect a total of 5 js files,
    // but only 3 have source maps. Therefore we expect only 3 API calls.
    expect(stub.callCount).to.equal(3);

    for (const file of scanner.files) {
      if (!file.sourceMappingURL) {
        continue;
      }

      // For this test, all API calls should fail.
      expect(file.errors.length).to.equal(1);
      expect(file.errors[0].error).to.have.string('invalid access token');
    }

    stub.restore();
  });
});
