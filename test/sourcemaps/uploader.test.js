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

  it('should upload a React Native bundle map under reactnativehost', async function() {
    const scanner = new Scanner({
      targetPath: './test/fixtures/builds/react-native/ios/main.jsbundle'
    });
    await scanner.scan();

    const uploader = new Uploader({
      accessToken: 'abcd',
      baseUrl: 'http://reactnativehost',
      codeVersion: '123'
    });
    const stub = sinon.stub(uploader.rollbarAPI, 'sourcemaps');
    stub.resolves(null);

    uploader.mapFiles(scanner.mappedFiles());

    await uploader.upload();

    expect(stub.callCount).to.equal(1);
    const request = stub.firstCall.args[0];
    // rollbar-react-native reports iOS frames as http://reactnativehost/main.jsbundle.
    expect(request.minified_url).to.equal('http://reactnativehost/main.jsbundle');
    expect(JSON.parse(request.source_map).file).to.equal('main.jsbundle');

    stub.restore();
  });

  it('should upload React Native bundles in subdirectories under their bundle name', async function() {
    const scanner = new Scanner({
      targetPath: './test/fixtures/builds/react-native'
    });
    await scanner.scan();

    const uploader = new Uploader({
      accessToken: 'abcd',
      baseUrl: 'http://reactnativehost/',
      codeVersion: '123'
    });
    const stub = sinon.stub(uploader.rollbarAPI, 'sourcemaps');
    stub.resolves(null);

    uploader.mapFiles(scanner.mappedFiles());

    await uploader.upload();

    expect(stub.callCount).to.equal(2);
    expect(stub.getCalls().map((call) => call.args[0].minified_url)).to.have.members([
      'http://reactnativehost/index.android.bundle',
      'http://reactnativehost/main.jsbundle'
    ]);

    stub.restore();
  });

  it('should upload a React Native map file for the bundle it is named after', async function() {
    const scanner = new Scanner({
      targetPath: './test/fixtures/builds/react-native/android/index.android.bundle.map'
    });
    await scanner.scan();

    const uploader = new Uploader({
      accessToken: 'abcd',
      baseUrl: 'http://reactnativehost/',
      codeVersion: '123'
    });
    const stub = sinon.stub(uploader.rollbarAPI, 'sourcemaps');
    stub.resolves(null);

    uploader.mapFiles(scanner.mappedFiles());

    await uploader.upload();

    expect(stub.callCount).to.equal(1);
    expect(stub.firstCall.args[0].minified_url).to.equal('http://reactnativehost/index.android.bundle');

    stub.restore();
  });

  it('should upload a map not named after its bundle for --bundle-name', async function() {
    const scanner = new Scanner({
      targetPath: './test/fixtures/builds/react-native-sourcemap/sourcemap.ios.js',
      bundleName: 'main.jsbundle'
    });
    await scanner.scan();

    // The --url-prefix from #16, without a trailing slash.
    const uploader = new Uploader({
      accessToken: 'abcd',
      baseUrl: 'http://reactnativehost',
      codeVersion: '123'
    });
    const stub = sinon.stub(uploader.rollbarAPI, 'sourcemaps');
    stub.resolves(null);

    uploader.mapFiles(scanner.mappedFiles());

    await uploader.upload();

    expect(stub.callCount).to.equal(1);
    expect(stub.firstCall.args[0].minified_url).to.equal('http://reactnativehost/main.jsbundle');

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
