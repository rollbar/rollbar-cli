/* globals describe */
/* globals it */
/* globals beforeEach */

const expect = require('chai').expect;
const fs = require('fs');
const os = require('os');
const path = require('path');
const sinon = require('sinon');

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
    expect(scanner.mappings).to.be.an('object').that.is.empty;
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

  it('should scan React Native bundles in a directory', async function() {
    const options = {
      targetPath: './test/fixtures/builds/react-native'
    };
    const scanner = new Scanner(options);
    await scanner.scan();
    const files = scanner.mappedFiles();

    expect(files.length).to.equal(2);

    // Hermes bytecode has no sourceMappingURL directive, so the adjacent map is used.
    // React Native frames carry only the bundle name, so the subdirectory is dropped.
    expect(files[0].fileName).to.equal('index.android.bundle');
    expect(files[0].sourceMappingURL).to.be.false;
    expect(files[0].mapPathName).to.equal('index.android.bundle.map');
    expect(files[0].mappedFile).to.equal('test/fixtures/builds/react-native/android/index.android.bundle.map');
    expect(files[0].validated).to.be.true;
    expect(files[0].errors).to.be.an('array').that.is.empty;

    expect(files[1].fileName).to.equal('main.jsbundle');
    expect(files[1].sourceMappingURL).to.be.true;
    expect(files[1].mapPathName).to.equal('main.jsbundle.map');
    expect(files[1].mappedFile).to.equal('test/fixtures/builds/react-native/ios/main.jsbundle.map');
    expect(files[1].validated).to.be.true;
    expect(files[1].errors).to.be.an('array').that.is.empty;
  });

  it('should scan a single bundle file', async function() {
    const options = {
      targetPath: './test/fixtures/builds/react-native/ios/main.jsbundle'
    };
    const scanner = new Scanner(options);
    await scanner.scan();
    const files = scanner.mappedFiles();

    expect(files.length).to.equal(1);
    expect(files[0].fileName).to.equal('main.jsbundle');
    expect(files[0].mapPathName).to.equal('main.jsbundle.map');
    expect(files[0].mappedFile).to.equal('test/fixtures/builds/react-native/ios/main.jsbundle.map');
    expect(files[0].validated).to.be.true;
  });

  it('should scan a single map file for the bundle it is named after', async function() {
    const options = {
      targetPath: './test/fixtures/builds/react-native/android/index.android.bundle.map'
    };
    const scanner = new Scanner(options);
    await scanner.scan();
    const files = scanner.mappedFiles();

    expect(files.length).to.equal(1);
    expect(files[0].fileName).to.equal('index.android.bundle');
    expect(files[0].sourceMappingURL).to.be.false;
    expect(files[0].mapPathName).to.equal('index.android.bundle.map');
    expect(files[0].mappedFile).to.equal('test/fixtures/builds/react-native/android/index.android.bundle.map');
    expect(files[0].validated).to.be.true;
  });

  // Rollbar's React Native docs generate maps with --sourcemap-output sourcemap.ios.js (#16).
  it('should scan a single map not named after its bundle with --bundle-name', async function() {
    const options = {
      targetPath: './test/fixtures/builds/react-native-sourcemap/sourcemap.ios.js',
      bundleName: 'main.jsbundle'
    };
    const scanner = new Scanner(options);
    await scanner.scan();
    const files = scanner.mappedFiles();

    expect(files.length).to.equal(1);
    expect(files[0].fileName).to.equal('main.jsbundle');
    expect(files[0].isMap).to.be.true;
    expect(files[0].mapPathName).to.equal('sourcemap.ios.js');
    expect(files[0].mappedFile).to.equal('test/fixtures/builds/react-native-sourcemap/sourcemap.ios.js');
    expect(files[0].validated).to.be.true;
    expect(files[0].errors).to.be.an('array').that.is.empty;
  });

  it('should ask for --bundle-name for a single map not named after its bundle', async function() {
    const options = {
      targetPath: './test/fixtures/builds/react-native-sourcemap/sourcemap.ios.js'
    };
    const scanner = new Scanner(options);
    await scanner.scan();
    const files = scanner.mappedFiles();

    expect(files.length).to.equal(1);
    expect(files[0].fileName).to.be.null;
    expect(files[0].isMap).to.be.true;
    expect(files[0].mapPathName).to.be.null;
    expect(files[0].validated).to.be.false;
    expect(files[0].errors[0].error).to.have.string('pass --bundle-name');
  });

  it('should let --bundle-name override the name of a .map file', async function() {
    const options = {
      targetPath: './test/fixtures/builds/react-native/android/index.android.bundle.map',
      bundleName: 'main.jsbundle'
    };
    const scanner = new Scanner(options);
    await scanner.scan();
    const files = scanner.mappedFiles();

    expect(files.length).to.equal(1);
    expect(files[0].fileName).to.equal('main.jsbundle');
    expect(files[0].validated).to.be.true;
  });

  it('should not treat a source map found in a directory as a bundle', async function() {
    const options = {
      targetPath: './test/fixtures/builds/react-native-sourcemap'
    };
    const scanner = new Scanner(options);
    const stub = sinon.stub(global.output, 'warn');

    try {
      await scanner.scan();
    } finally {
      stub.restore();
    }
    const files = scanner.mappedFiles();

    expect(files.length).to.equal(1);
    expect(files[0].isMap).to.be.false;
    expect(files[0].mapPathName).to.be.null;
    expect(files[0].validated).to.be.false;
    expect(stub.calledWith('', 'this is a source map, not a bundle: pass it as <path> with --bundle-name')).to.be.true;
  });

  it('should refuse --bundle-name for a directory', async function() {
    const options = {
      targetPath: './test/fixtures/builds/react-native',
      bundleName: 'main.jsbundle'
    };
    const scanner = new Scanner(options);
    const stub = sinon.stub(global.output, 'warn');

    try {
      await scanner.scan();
    } finally {
      stub.restore();
    }

    expect(scanner.mappedFiles()).to.be.an('array').that.is.empty;
    expect(stub.firstCall.args[1]).to.have.string('--bundle-name needs <path> to be a single bundle or source map file');
  });

  it('should resolve maps next to bundles in subdirectories', async function() {
    const options = {
      targetPath: './test/fixtures/builds/react16/build'
    };
    const scanner = new Scanner(options);
    await scanner.scan();
    const files = scanner.mappedFiles();

    expect(files[3].fileName).to.equal('static/js/main.d504f0ad.chunk.js');
    expect(files[3].mappedFile).to.equal('test/fixtures/builds/react16/build/static/js/main.d504f0ad.chunk.js.map');
  });

  it('should use an absolute sourceMappingURL as the mapped file', async function() {
    const mapPath = path.resolve('test/fixtures/builds/react-native/ios/main.jsbundle.map');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rollbar-cli-'));
    const bundlePath = path.join(tmpDir, 'main.jsbundle');
    fs.writeFileSync(bundlePath, 'App();\n//# sourceMappingURL=' + mapPath + '\n');

    try {
      const scanner = new Scanner({ targetPath: bundlePath });
      await scanner.scan();
      const files = scanner.mappedFiles();

      expect(files.length).to.equal(1);
      expect(files[0].mappedFile).to.equal(mapPath);
      expect(files[0].validated).to.be.true;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should warn when several maps upload under the same name', function() {
    const scanner = new Scanner({ targetPath: './test/fixtures/builds/react-native' });
    scanner.files = [
      { fileName: 'index.android.bundle', filePathName: 'a/index.android.bundle', validated: true },
      { fileName: 'index.android.bundle', filePathName: 'b/index.android.bundle', validated: true },
      { fileName: 'main.jsbundle', filePathName: 'c/main.jsbundle', validated: true },
      { fileName: 'main.jsbundle', filePathName: 'd/main.jsbundle', validated: false }
    ];
    const stub = sinon.stub(global.output, 'warn');

    scanner.warnDuplicateNames();

    expect(stub.callCount).to.equal(1);
    expect(stub.firstCall.args[1]).to.equal(
      '2 maps upload as index.android.bundle, so only one can apply: a/index.android.bundle, b/index.android.bundle'
    );

    stub.restore();
  });

  it('should find no files at a missing path', async function() {
    const options = {
      targetPath: './test/fixtures/builds/does-not-exist'
    };
    const scanner = new Scanner(options);
    await scanner.scan();

    expect(scanner.mappedFiles()).to.be.an('array').that.is.empty;
  });

  it('should return parsing errors', async function() {
    const options = {
      targetPath: './test/fixtures/builds/invalid'
    };
    const scanner = new Scanner(options);
    await scanner.scan();
    const files = scanner.mappedFiles();

    expect(files[0].errors[0].error).to.have.string('Error parsing map file:');
    expect(files[1].errors[0].error).to.have.string('Error parsing map file: "sources" is a required argument');
  });
});
