/* globals describe */
/* globals it */

const expect = require('chai').expect;
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;

describe('rollbar-cli upload-sourcemaps', function() {
  it('returns help output', done => {
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

    for(let i; i < lines.length; i+=2) {
      expect(lines[i]).to.have.string('[Found ]');
    }
  });

  it('uploads react project via signed URL', function() {
    this.timeout(5000);

    const stdout = execSync('./bin/rollbar upload-sourcemaps ./test/fixtures/builds/react16/build --access-token 1234 --url-prefix "http://localhost:3000/" --code-version react16 -D --signed-url');

    const lines = stdout.toString().split('\n');

    expect(lines.length).to.equal(14);

    for(let i; i < lines.length; i+=2) {
      expect(lines[i]).to.have.string('[Found ]');
    }
  });
});
