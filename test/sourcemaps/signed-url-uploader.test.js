/* globals describe */
/* globals it */
/* globals beforeEach */
/* globals afterEach */

const expect = require('chai').expect;
const sinon = require('sinon');
const axios = require('axios')
const AdmZip = require('adm-zip');
const fs = require('fs');
const http = require('http');
const path = require('path');

const SignedUrlUploader = require('../../src/sourcemaps/signed-url-uploader');
const Scanner = require('../../src/sourcemaps/scanner');
const Output = require('../../src/common/output');

// The angular9 fixture keeps each map next to its bundle, which is where
// Scanner resolves mappedFile.
const targetPath = './test/fixtures/builds/angular9/dist/app';
const manifestData = JSON.stringify({
  projectID: 123,
  version: 'angular9',
  baseUrl: 'http://localhost:3000/'
}, null, 2);

async function scanFiles(scanPath = targetPath) {
  const scanner = new Scanner({ targetPath: scanPath, sources: true });
  await scanner.scan();
  return scanner.mappedFiles();
}

function readZip(buffer) {
  const zip = new AdmZip(buffer);
  const entries = {};
  for (const entry of zip.getEntries()) {
    entries[entry.entryName] = entry.getData();
  }
  return entries;
}

describe('Uploader()', function() {
  it('should initialize successfully', function() {

    const signedUrlUploader = new SignedUrlUploader();

    expect(signedUrlUploader.zippedMapFile).to.equal('');
    expect(signedUrlUploader.files).to.be.an('array').that.is.empty;
  });
});

describe('.zipFiles()', function() {
  beforeEach(function() {
    global.output = new Output({quiet: true});
  });

  afterEach(function() {
    sinon.restore();
  });

  it('should zip the manifest and every validated map file', async function() {
    const files = await scanFiles();
    const validated = files.filter((file) => file.validated);
    expect(validated).to.have.lengthOf(5);

    const signedUrlUploader = new SignedUrlUploader({ manifestData: manifestData });
    signedUrlUploader.mapFiles(files);
    signedUrlUploader.zipFiles();

    const entries = readZip(signedUrlUploader.zipBuffer);
    const expectedNames = ['manifest.json'].concat(validated.map((file) => file.fileName + '.map'));
    expect(Object.keys(entries)).to.have.members(expectedNames);

    // manifestData is a string; it must round-trip unchanged.
    expect(entries['manifest.json'].toString()).to.equal(manifestData);
    for (const file of validated) {
      const entry = entries[file.fileName + '.map'];
      expect(entry.equals(fs.readFileSync(file.mappedFile))).to.be.true;
    }
  });

  it('should leave out files that failed validation', async function() {
    const files = [
      { validated: true, fileName: 'main-es5.js', mappedFile: path.join(targetPath, 'main-es5.js.map') },
      { validated: false, fileName: 'runtime-es5.js', mappedFile: path.join(targetPath, 'runtime-es5.js.map') }
    ];

    const signedUrlUploader = new SignedUrlUploader({ manifestData: manifestData });
    signedUrlUploader.mapFiles(files);
    signedUrlUploader.zipFiles();

    const entries = readZip(signedUrlUploader.zipBuffer);
    expect(Object.keys(entries)).to.have.members(['manifest.json', 'main-es5.js.map']);
  });

  // The server uploads each entry for <baseUrl><entry name without .map>, so entries must be
  // named after fileName to get the same minified_url as the standard upload.
  it('should name nested web build maps after their path in the build', async function() {
    const files = await scanFiles('./test/fixtures/builds/react16/build');

    const signedUrlUploader = new SignedUrlUploader({ manifestData: manifestData });
    signedUrlUploader.mapFiles(files);
    signedUrlUploader.zipFiles();

    expect(Object.keys(readZip(signedUrlUploader.zipBuffer))).to.have.members([
      'manifest.json',
      'static/js/2.373ccd69.chunk.js.map',
      'static/js/main.d504f0ad.chunk.js.map',
      'static/js/runtime~main.a8a9905a.js.map'
    ]);
  });

  it('should name React Native maps after the bundle name alone', async function() {
    const files = await scanFiles('./test/fixtures/builds/react-native');

    const signedUrlUploader = new SignedUrlUploader({ manifestData: manifestData });
    signedUrlUploader.mapFiles(files);
    signedUrlUploader.zipFiles();

    expect(Object.keys(readZip(signedUrlUploader.zipBuffer))).to.have.members([
      'manifest.json', 'index.android.bundle.map', 'main.jsbundle.map'
    ]);
  });

  it('should name a map after its bundle even when the map is named differently', async function() {
    const files = [{
      validated: true,
      fileName: 'main.jsbundle',
      mappedFile: './test/fixtures/builds/react-native/android/index.android.bundle.map'
    }];

    const signedUrlUploader = new SignedUrlUploader({ manifestData: manifestData });
    signedUrlUploader.mapFiles(files);
    signedUrlUploader.zipFiles();

    expect(Object.keys(readZip(signedUrlUploader.zipBuffer))).to.have.members(['manifest.json', 'main.jsbundle.map']);
  });

  it('should start a new archive on each call', async function() {
    const files = await scanFiles();

    const first = new SignedUrlUploader({ manifestData: manifestData });
    first.mapFiles(files);
    first.zipFiles();

    const second = new SignedUrlUploader({ manifestData: '{}' });
    second.mapFiles([]);
    second.zipFiles();

    const entries = readZip(second.zipBuffer);
    expect(Object.keys(entries)).to.deep.equal(['manifest.json']);
    expect(entries['manifest.json'].toString()).to.equal('{}');
  });

  it('should report files it cannot read and zip the rest', async function() {
    const status = sinon.spy(global.output, 'status');
    const files = [{ validated: true, fileName: 'missing.js', mappedFile: path.join(targetPath, 'missing.js.map') }];

    const signedUrlUploader = new SignedUrlUploader({ manifestData: manifestData });
    signedUrlUploader.mapFiles(files);
    signedUrlUploader.zipFiles();

    expect(status.calledWith('Error', sinon.match('missing.js.map'))).to.be.true;
    expect(Object.keys(readZip(signedUrlUploader.zipBuffer))).to.deep.equal(['manifest.json']);
  });

  it('should report a missing manifest and still produce an archive', async function() {
    const status = sinon.spy(global.output, 'status');

    const signedUrlUploader = new SignedUrlUploader();
    signedUrlUploader.mapFiles([]);
    signedUrlUploader.zipFiles();

    expect(status.calledWith('Error')).to.be.true;
    // An empty zip is just the 22-byte end-of-central-directory record.
    expect(signedUrlUploader.zipBuffer.length).to.equal(22);
  });
});

describe('.upload()', function() {
  const signedUrl = 'https://storage.example.com/bundle.zip?signature=abc';

  beforeEach(function() {
    global.output = new Output({quiet: true});
  });

  afterEach(function() {
    sinon.restore();
  });

  it('should upload signed url successfully', async function() {
    const files = await scanFiles();
    const status = sinon.spy(global.output, 'status');
    const stub = sinon.stub(axios, 'put');
    stub.resolves({
      status: 200,
      statusText: 'Success',
    });

    const signedUrlUploader = new SignedUrlUploader({ manifestData: manifestData });
    await signedUrlUploader.upload(false, files, signedUrl);

    expect(stub.callCount).to.equal(1);
    const [url, body, config] = stub.firstCall.args;
    expect(url).to.equal(signedUrl);
    expect(body).to.equal(signedUrlUploader.zipBuffer);
    expect(config.headers['Content-Type']).to.equal('application/octet-stream');
    expect(readZip(body)).to.have.property('manifest.json');
    expect(status.calledWith('Success', 'Uploaded zip file successfully')).to.be.true;
  });

  it('should report a non-200 response', async function() {
    const files = await scanFiles();
    const status = sinon.spy(global.output, 'status');
    sinon.stub(axios, 'put').resolves({ status: 403, statusText: 'Forbidden' });

    const signedUrlUploader = new SignedUrlUploader({ manifestData: manifestData });
    await signedUrlUploader.upload(false, files, signedUrl);

    expect(status.calledWith('Error', 'Could not upload the zip file')).to.be.true;
  });

  it('should report a request that throws', async function() {
    const files = await scanFiles();
    const status = sinon.spy(global.output, 'status');
    sinon.stub(axios, 'put').rejects(new Error('socket hang up'));

    const signedUrlUploader = new SignedUrlUploader({ manifestData: manifestData });
    await signedUrlUploader.upload(false, files, signedUrl);

    expect(status.calledWith('Error', 'socket hang up')).to.be.true;
  });

  it('should not upload on a dry run', async function() {
    const files = await scanFiles();
    const stub = sinon.stub(axios, 'put');

    const signedUrlUploader = new SignedUrlUploader({ manifestData: manifestData });
    await signedUrlUploader.upload(true, files, signedUrl);

    expect(stub.called).to.be.false;
  });

  it('should upload zips larger than 10 MB', async function() {
    let received = 0;
    const server = http.createServer((req, res) => {
      req.on('data', (chunk) => { received += chunk.length; });
      req.on('end', () => { res.writeHead(200); res.end(); });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    const size = 11 * 1024 * 1024;
    const signedUrlUploader = new SignedUrlUploader();
    signedUrlUploader.zipFiles = function() { this.zipBuffer = Buffer.alloc(size); };
    const spy = sinon.spy(axios, 'put');

    try {
      await signedUrlUploader.upload(false, [], `http://127.0.0.1:${server.address().port}/`);
    } finally {
      server.close();
    }

    expect(spy.firstCall.args[2].maxBodyLength).to.equal(Infinity);
    expect(received).to.equal(size);
  });
});
