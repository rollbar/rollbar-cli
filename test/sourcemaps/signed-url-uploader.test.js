/* globals describe */
/* globals it */
/* globals beforeEach */

const expect = require('chai').expect;
const sinon = require('sinon');
const fs = require('fs')
const axios = require('axios')

const SignedUrlUploader = require('../../src/sourcemaps/signed-url-uploader');
const Scanner = require('../../src/sourcemaps/scanner');
const Output = require('../../src/common/output');

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

  it('should zip files successfully',  async function() {
    const scannerOptions = {
      targetPath: './test/fixtures/builds/react16/build',
      sources: true
    };
    const scanner = new Scanner(scannerOptions);
    await scanner.scan();
    const files = scanner.mappedFiles();

    const signedUrlUploader = new SignedUrlUploader();

    signedUrlUploader.mapFiles(files);
    signedUrlUploader.zipFiles();

    expect(signedUrlUploader.zipBuffer.length).to.equal(22);

  });
});

describe('.upload()', function() {
  beforeEach(function() {
    global.output = new Output({quiet: true});
  });

  it('should upload signed url successfully', async function() {

    const scannerOptions = {
      targetPath: './test/fixtures/builds/react16/build',
      sources: true
    };
    const scanner = new Scanner(scannerOptions);
    await scanner.scan();
    const files = scanner.mappedFiles();


    const signedUrlUploader = new SignedUrlUploader();

    const stub = sinon.stub(axios, 'put');
    stub.resolves({
      status: 200,
      statusText: 'Success',
    });

    await signedUrlUploader.upload(false, files);
    expect(stub.callCount).to.equal(1);

  });
});
