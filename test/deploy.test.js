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
});
