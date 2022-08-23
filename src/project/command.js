'use strict';

const Deployer = require('./deployer.js');
const Output = require('../common/output.js');

exports.command = 'create-project [options]'

exports.describe = 'Create new Rollbar project'

exports.builder = function (yargs) {
  return yargs
  .option('access-token', {
    describe: 'Use an Account Access Token with \'write\' scope',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('name', {
    describe: 'Name of the project. Must start with a letter; can contain letters, numbers, spaces, underscores, hyphens, periods, and commas. Max length 32 characters.',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
}

exports.handler = async function (argv) {
  global.output = new Output({
    verbose: argv['verbose'],
    quiet: argv['quiet']
  });

  const deployer = new Deployer({
    accessToken: argv['access-token'],
    name: argv['name']
  })

  await deployer.createProject();
}
