'use strict';

const Scanner = require('./scanner');
const Uploader = require('./uploader');
const Output = require('../common/output.js');

exports.command = 'sourcemaps [options]'

exports.describe = 'upload sourcemaps'

exports.builder = function (yargs) {
  return yargs.option('p', {
    alias: 'path',
    describe: 'the path to scan for minified js and map files',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('t', {
    alias: 'token',
    describe: 'Access token for the Rollbar API',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('b', {
    alias: 'baseUrl',
    describe: 'Base part of the stack trace URLs',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('V', {
    alias: 'validate',
    describe: 'Validate source maps without uploading',
    requiresArg: false,
    type: 'boolean',
    demandOption: false
  })
  .option('c', {
    alias: 'codeVersion',
    describe: 'Code version string must match value in the Rollbat item',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('s', {
    alias: 'sources',
    describe: 'Include original sources',
    requiresArg: false,
    type: 'boolean',
    demandOption: false
  })
}

exports.handler = async function (argv) {
  global.output = new Output({
    verbose: argv['verbose'],
    quiet: argv['quiet']
  });

  const scanner = new Scanner({
    targetPath: argv['path'],
    sources: argv['sources']
  });

  await scanner.scan();

  if (!argv['validate']) {
    const uploader = new Uploader({
      accessToken: argv['token'],
      baseUrl: argv['baseUrl'],
      codeVersion: argv['codeVersion']
    })

    uploader.mapFiles(scanner.files);

    await uploader.upload();
  }
}
