/* globals describe */
/* globals it */
/* globals beforeEach */
/* globals afterEach */

const expect = require('chai').expect;

const Command = require('../../src/deploy/command');
const Output = require('../../src/common/output');
const yargs = require('yargs');
const sinon = require('sinon');

describe('deploy Command()', function() {
  beforeEach(function() {
    global.output = new Output({verbose: false});
    this.currentTest.stubWarn = sinon.spy(global.output, 'warn');
    this.currentTest.stubSuccess = sinon.spy(global.output, 'success');
  });

  afterEach(function() {
    //global.output = null;
    this.currentTest.stubWarn.restore();
    this.currentTest.stubSuccess.restore();
  });

  it('returns help output', async () => {
    const parser = yargs.command(Command).help();

    const result = await new Promise((resolve) => {
      parser.parse('--help', (_err, _argv, output) => {
        resolve(output);
      })
    });

    expect(result).to.have.string('notify-deploy [options]');
  });
});
