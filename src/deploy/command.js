'use strict';

const Deployer = require('./deployer.js');
const Output = require('../common/output.js');

exports.command = 'notify-deploy [options]'

exports.describe = 'Notify deploy to Rollbar'

exports.builder = function (yargs) {
  return yargs
  .option('access-token', {
    describe: 'Use a post server item access token for the Rollbar API',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('code-version', {
    describe: 'Code version or Git SHA of revision being deployed',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('deploy-id', {
    describe: 'ID of the deploy to update',
    requiresArg: false,
    type: 'string',
    demandOption: false
  })
  .option('environment', {
    describe: 'Environment to which the revision was deployed such as production',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('status', {
    describe: 'Status of the deploy - started, succeeded (default), failed, or timed_out',
    requiresArg: false,
    type: 'string',
    demandOption: false
  })
  .option('rollbar-username', {
    describe: 'Rollbar username of person who deployed',
    requiresArg: false,
    type: 'string',
    demandOption: false
  })
  .option('local-username', {
    describe: 'Local username of person who deployed',
    requiresArg: false,
    type: 'string',
    demandOption: false
  })
  .option('comment', {
    describe: 'Additional text to include with the deploy',
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
    rollbarUsername: argv['rollbar-username'],
    localUsername: argv['local-username'],
    comment: argv['comment']
  })

  await deployer.deploy();
}
