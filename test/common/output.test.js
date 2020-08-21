/* globals describe */
/* globals it */

const expect = require('chai').expect;

const Output = require('../../src/common/output');

describe('Output()', function() {
  it('should initialize successfully', function() {
    const options = {
      verbose: true,
      quiet: true,
      labelSize: 8
    };
    const output = new Output(options);

    expect(output.all).to.equal(!!options.verbose);
    expect(output.enable).to.equal(!options.quiet);
    expect(output.labelSize).to.equal(options.labelSize);
  });
});
