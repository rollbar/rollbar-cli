/* globals describe */
/* globals it */
/* globals beforeEach */

const expect = require('chai').expect;
//const sinon = require('sinon');

const Scanner = require('../../src/sourcemaps/scanner');
const Output = require('../../src/common/output');

describe('Scanner()', function() {
  beforeEach(function(){
    global.output = new Output({verbose: false});
  })

  it('should initialize successfully', function() {
    const options = {
      targetPath: 'foo',
      sources: true
    };
    const scanner = new Scanner(options);

    expect(scanner.targetPath).to.equal(options.targetPath);
    expect(scanner.sources).to.equal(options.sources);
    expect(scanner.projectPath).to.equal('./');
    expect(scanner.files).to.be.an('array').that.is.empty;
  });
});

describe('.scan()', function() {
  beforeEach(function(){
    global.output = new Output({verbose: false});
  })

  it('should scan and load files from a directory', async function() {
    const options = {
      targetPath: './test/fixtures/builds/react16/build',
      sources: true
    };
    const scanner = new Scanner(options);
    await scanner.scan();
    const files = scanner.mappedFiles();

    expect(files.length).to.equal(5);

    // First two files not source mapped
    expect(files[0].fileName).to.have.string('precache-manifest');
    expect(files[0].sourceMappingURL).to.be.false;
    expect(files[0].mapPathName).to.be.null;
    expect(files[0].errors).to.be.an('array').that.is.empty;

    expect(files[1].fileName).to.have.string('service-worker.js');
    expect(files[1].sourceMappingURL).to.be.false;
    expect(files[1].mapPathName).to.be.null;
    expect(files[1].errors).to.be.an('array').that.is.empty;

    // Last three files are source mapped
    expect(files[2].fileName).to.have.string('2.373ccd69.chunk.js');
    expect(files[2].sourceMappingURL).to.be.true;
    expect(files[2].mapPathName).to.have.string('2.373ccd69.chunk.js.map');
    expect(files[2].metadata.version).to.equal(3);
    expect(files[2].metadata.sources.length).to.equal(16);
    expect(files[2].errors).to.be.an('array').that.is.empty;

    expect(files[3].fileName).to.have.string('main.d504f0ad.chunk.js');
    expect(files[3].sourceMappingURL).to.be.true;
    expect(files[3].mapPathName).to.have.string('main.d504f0ad.chunk.js.map');
    expect(files[3].metadata.version).to.equal(3);
    expect(files[3].metadata.sources.length).to.equal(6);
    expect(files[3].errors).to.be.an('array').that.is.empty;

    expect(files[4].fileName).to.have.string('runtime~main.a8a9905a.js');
    expect(files[4].sourceMappingURL).to.be.true;
    expect(files[4].mapPathName).to.have.string('runtime~main.a8a9905a.js.map');
    expect(files[4].metadata.version).to.equal(3);
    expect(files[4].metadata.sources.length).to.equal(1);
    expect(files[4].errors).to.be.an('array').that.is.empty;
  });

  it('should handle errors loading files from a directory', async function() {
    const options = {
      targetPath: './test/fixtures/builds/angular9',
      sources: true
    };
    const scanner = new Scanner(options);
    await scanner.scan();
    const files = scanner.mappedFiles();

    expect(files.length).to.equal(10);

    expect(files[0].fileName).to.have.string('main-es2015.js');
    expect(files[0].sourceMappingURL).to.be.false;
    expect(files[0].errors).to.be.an('array').that.is.empty;

    expect(files[1].fileName).to.have.string('main-es5.js');
    expect(files[1].sourceMappingURL).to.be.true;
    expect(files[1].errors).to.be.an('array').that.is.empty;

    expect(files[2].fileName).to.have.string('polyfills-es2015.js');
    expect(files[2].sourceMappingURL).to.be.false;
    expect(files[2].errors).to.be.an('array').that.is.empty;

    expect(files[3].fileName).to.have.string('polyfills-es5.js');
    expect(files[3].sourceMappingURL).to.be.true;
    expect(files[3].errors).to.be.an('array').that.is.empty;

    expect(files[4].fileName).to.have.string('runtime-es2015.js');
    expect(files[4].sourceMappingURL).to.be.false;
    expect(files[4].errors).to.be.an('array').that.is.empty;

    expect(files[5].fileName).to.have.string('runtime-es5.js');
    expect(files[5].sourceMappingURL).to.be.true;
    expect(files[5].errors).to.be.an('array').that.is.empty;

    expect(files[6].fileName).to.have.string('styles-es2015.js');
    expect(files[6].sourceMappingURL).to.be.false;
    expect(files[6].errors).to.be.an('array').that.is.empty;

    expect(files[7].fileName).to.have.string('styles-es5.js');
    expect(files[7].sourceMappingURL).to.be.true;
    expect(files[7].errors).to.be.an('array').that.is.empty;

    expect(files[8].fileName).to.have.string('vendor-es2015.js');
    expect(files[8].sourceMappingURL).to.be.true;
    expect(files[8].errors.length).to.equal(1);
    expect(files[8].errors[0].error).to.have.string('Error parsing map file');

    expect(files[9].fileName).to.have.string('vendor-es5.js');
    expect(files[9].sourceMappingURL).to.be.true;
    expect(files[9].errors).to.be.an('array').that.is.empty;
  });

  it('should return parsing errors', async function() {
    const options = {
      targetPath: './test/fixtures/builds/invalid'
    };
    const scanner = new Scanner(options);
    await scanner.scan();
    const files = scanner.mappedFiles();

    expect(files[0].errors[0].error).to.have.string('Error parsing map file: Unexpected token $ in JSON at position 24');
    expect(files[1].errors[0].error).to.have.string('Error parsing map file: "sources" is a required argument');
  });
});
