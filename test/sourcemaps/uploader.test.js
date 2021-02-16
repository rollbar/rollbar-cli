/* globals describe */
/* globals it */
/* globals beforeEach */

const expect = require('chai').expect;
const sinon = require('sinon');
const fs = require('fs')
const axios = require('axios')

const Uploader = require('../../src/sourcemaps/uploader');
const Scanner = require('../../src/sourcemaps/scanner');
const Output = require('../../src/common/output');

describe('Uploader()', function() {
  it('should initialize successfully', function() {

    const uploader = new Uploader();

    expect(uploader.zippedMapFile).to.equal('');
    expect(uploader.files).to.be.an('array').that.is.empty;
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

    const uploader = new Uploader();

    uploader.mapFiles(files);
    uploader.zipFiles(scanner.targetPath, 'output.zip');

    const fileSize = fs.statSync(uploader.zippedMapFile);
    expect(fileSize['size']).to.not.equal(0);

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


    const uploader = new Uploader();

    uploader.mapFiles(files);

    uploader.zipFiles(scanner.targetPath, 'output.zip');

    const stub = sinon.stub(axios, 'put');
    stub.resolves({
      status: 200,
      statusText: 'Success',
    });

    await uploader.upload();
    expect(stub.callCount).to.equal(1);

  });
});
