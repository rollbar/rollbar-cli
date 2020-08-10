'use strict';

const yargs = require('yargs');

function cli() {
  yargs
    .option('v', {
      alias: 'verbose',
      describe: 'Verbose status output',
      requiresArg: false,
      type: 'boolean',
      demandOption: false
    })
    .option('q', {
      alias: 'quiet',
      describe: 'Silent status output',
      requiresArg: false,
      type: 'boolean',
      demandOption: false
    })
    .command(require('./sourcemaps/command'))
      .help()
      .argv

  return 0;
}

module.exports = cli;
