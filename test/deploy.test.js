/* globals describe */
/* globals it */
const expect = require('chai').expect;
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;

describe('rollbar-cli notify-deploy', function() {
  it('returns help output', done => {
    this.timeout(5000);

    exec('./bin/rollbar notify-deploy --help', 'utf8', (_err, stdout, _stderr) => {
      expect(stdout).to.have.string('notify-deploy [options]');
      done();
    })
  });

  it('should handle error response', done => {
    this.timeout(5000);

    const stdout = execSync('./bin/rollbar notify-deploy --access-token 1234 --code-version 1.0.1 --environment production --rollbar-username foobar --status succeeded --deploy-id 12345678 --local-username foo_bar --comment \'Deploy Test\'');

    const lines = stdout.toString().split('\n');

    expect(lines.length).to.equal(2);
    expect(stdout.toString()).to.have.string('invalid access token');

    done();
  });
});
