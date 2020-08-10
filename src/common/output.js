'use strict';

const util = require('util');
const chalk = require('chalk');

class Output {
  constructor(options = {}) {
    this.all = !!options.verbose;
    this.enable = !options.quiet;
    this.labelSize = options.labelSize || 6;
  }

  status() {
    this.write(chalk.white(this.format(...arguments)));
  }

  verbose() {
    if (this.all) {
      this.write(chalk.grey(this.format(...arguments)));
    }
  }

  warn() {
    this.write(chalk.yellow(this.format(...arguments)));
  }

  error() {
    this.write(chalk.red(this.format(...arguments)));
  }

  fail() {
    this.write(chalk.red(this.format(...arguments)));
  }

  success() {
    this.write(chalk.green(this.format(...arguments)));
  }

  format() {
    const args = Array.from(arguments);
    let paddedLabel = args[0].padEnd(this.labelSize, ' ');

    if (args[0].trim().length) {
      paddedLabel = `[${paddedLabel}] `;
    } else {
      paddedLabel = ` ${paddedLabel}  `;
    }

    return paddedLabel + util.format(...args.slice(1)) + '\n';
  }

  write(str) {
    if (this.enable) {
      process.stdout.write(str);
    }
  }
}

module.exports = Output;
