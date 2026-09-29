/* globals describe */
/* globals it */
/* globals beforeEach */
/* globals afterEach */

const expect = require('chai').expect;
const sinon = require('sinon');
const axios = require('axios')
const AdmZip = require('adm-zip');
const fs = require('fs');
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

async function scanFiles() {
  const scanner = new Scanner({ targetPath: targetPath, sources: true });
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
    const expectedNames = ['manifest.json'].concat(validated.map((file) => path.basename(file.mappedFile)));
    expect(Object.keys(entries)).to.have.members(expectedNames);

    // manifestData is a string; it must round-trip unchanged.
    expect(entries['manifest.json'].toString()).to.equal(manifestData);
    for (const file of validated) {
      const entry = entries[path.basename(file.mappedFile)];
      expect(entry.equals(fs.readFileSync(file.mappedFile))).to.be.true;
    }
  });

  it('should leave out files that failed validation', async function() {
    const files = [
      { validated: true, mappedFile: path.join(targetPath, 'main-es5.js.map') },
      { validated: false, mappedFile: path.join(targetPath, 'runtime-es5.js.map') }
    ];

    const signedUrlUploader = new SignedUrlUploader({ manifestData: manifestData });
    signedUrlUploader.mapFiles(files);
    signedUrlUploader.zipFiles();

    const entries = readZip(signedUrlUploader.zipBuffer);
    expect(Object.keys(entries)).to.have.members(['manifest.json', 'main-es5.js.map']);
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
    const files = [{ validated: true, mappedFile: path.join(targetPath, 'missing.js.map') }];

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
});
