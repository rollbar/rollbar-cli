/* globals describe */
/* globals it */

const expect = require('chai').expect;
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;

describe('rollbar-cli upload-sourcemaps', function() {
  it('returns help output', function(done) {
    this.timeout(5000);

    exec('./bin/rollbar upload-sourcemaps --help', 'utf8', (_err, stdout, _stderr) => {
      expect(stdout).to.have.string('upload-sourcemaps <path> [options]');
      done();
    })
  });

  it('uploads react project', function() {
    this.timeout(5000);

    const stdout = execSync('./bin/rollbar upload-sourcemaps ./test/fixtures/builds/react16/build --access-token 1234 --url-prefix "http://localhost:3000/" --code-version react16 -D');

    const lines = stdout.toString().split('\n');

    expect(lines.length).to.equal(14);

    expect(lines.filter((line) => line.startsWith('[Found ]'))).to.have.lengthOf(5);
  });

  it('uploads a react native bundle file', function() {
    this.timeout(5000);

    const stdout = execSync('./bin/rollbar upload-sourcemaps ./test/fixtures/builds/react-native/ios/main.jsbundle --access-token 1234 --url-prefix "http://reactnativehost/" --code-version rn -D');

    const lines = stdout.toString().split('\n');

    expect(lines.filter((line) => line.startsWith('[Found ]'))).to.have.lengthOf(1);
    expect(lines.map((line) => line.trim())).to.include.members(['main.jsbundle.map', 'valid']);
  });

  it('uploads a react native map not named after its bundle with --bundle-name', function() {
    this.timeout(5000);

    const stdout = execSync('./bin/rollbar upload-sourcemaps ./test/fixtures/builds/react-native-sourcemap/sourcemap.ios.js --bundle-name main.jsbundle --access-token 1234 --url-prefix "http://reactnativehost" --code-version rn -D');

    const lines = stdout.toString().split('\n');

    expect(lines.filter((line) => line.startsWith('[Found ]'))).to.have.lengthOf(1);
    expect(lines.map((line) => line.trim())).to.include.members(['sourcemap.ios.js', 'valid']);
  });

  it('asks for --bundle-name for a react native map not named after its bundle', function() {
    this.timeout(5000);

    const stdout = execSync('./bin/rollbar upload-sourcemaps ./test/fixtures/builds/react-native-sourcemap/sourcemap.ios.js --access-token 1234 --url-prefix "http://reactnativehost" --code-version rn -D');

    const lines = stdout.toString().split('\n');

    expect(lines.filter((line) => line.startsWith('[Error ]'))).to.have.lengthOf(1);
    expect(lines.map((line) => line.trim())).to.not.include('valid');
  });

  it('uploads react project via signed URL', function() {
    this.timeout(5000);

    const stdout = execSync('./bin/rollbar upload-sourcemaps ./test/fixtures/builds/react16/build --access-token 1234 --url-prefix "http://localhost:3000/" --code-version react16 -D --next');

    const lines = stdout.toString().split('\n');

    expect(lines.length).to.equal(14);

    expect(lines.filter((line) => line.startsWith('[Found ]'))).to.have.lengthOf(5);
  });
});
