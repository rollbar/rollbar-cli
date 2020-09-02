'use strict';

const Deployer = require('./deployer.js');
const Output = require('../common/output.js');

exports.command = 'notify-deploy [options]'

exports.describe = 'Notify deploy to Rollbar'

exports.builder = function (yargs) {
  return yargs
  .option('access-token', {
    describe: 'Access token for the Rollbar API',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('code-version', {
    describe: 'Code version string must match value in the Rollbar item',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('deploy-id', {
    describe: 'deploy id to update the status of a particular deploy',
    requiresArg: false,
    type: 'string',
    demandOption: false
  })
  .option('environment', {
    describe: 'Name of the environment such as production, staging',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('status', {
    describe: 'deploy status such as started, succeeded',
    requiresArg: false,
    type: 'string',
    demandOption: false
  })
  .option('username', {
    describe: 'Rollbar username',
    requiresArg: false,
    type: 'string',
    demandOption: false
  })
}

exports.handler = async function (argv) {
  global.output = new Output({
    verbose: argv['verbose'],
    quiet: argv['quiet']
  });

  const deployer = new Deployer({
    accessToken: argv['access-token'],
    codeVersion: argv['code-version'],
    deployId: argv['deploy-id'],
    environment: argv['environment'],
    status: argv['status'],
    username: argv['username']
  })

  await deployer.deploy();
}