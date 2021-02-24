'use strict';

const Scanner = require('./scanner');
const Uploader = require('./uploader');
const SignedUrlUploader = require('./signed-url-uploader');
const Requester = require('./requester');
const Output = require('../common/output.js');

exports.command = 'upload-sourcemaps <path> [options]'

exports.describe = 'upload sourcemaps'

exports.builder = function (yargs) {
  return yargs
  .option('access-token', {
    describe: 'Access token for the Rollbar API',
    requiresArg: true,
    type: 'string',
    demandOption: true
  })
  .option('url-prefix', {
    describe: 'Base part of the stack trace URLs',
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
  .option('D', {
    alias: 'dry-run',
    describe: 'Scan and validate source maps without uploading',
    requiresArg: false,
    type: 'boolean',
    demandOption: false
  })
      .option('signed-url', {
        describe: 'Zip all the source map files and upload via signed URL',
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

  if (argv['signed-url']) {
    const requester = new Requester({
      accessToken: argv['access-token'],
      baseUrl: argv['url-prefix'],
      codeVersion: argv['code-version']
    })

    const signedUrlUploader = new SignedUrlUploader()
    await requester.requestSignedUrl(argv['dry-run'])
    if (requester.data && requester.data['err'] === 0) {
      requester.setProjectID(requester.data['result']['project_id'])
      const manifestFile = requester.createManifestFile(scanner.targetPath)
      signedUrlUploader.mapFiles(scanner.files);
      signedUrlUploader.zipFiles(scanner.targetPath, requester.data['result']['filename'], manifestFile);
      await signedUrlUploader.upload(argv['dry-run'], requester.data['result']['signed_url'])
    }
  } else {
    const uploader = new Uploader({
      accessToken: argv['access-token'],
      baseUrl: argv['url-prefix'],
      codeVersion: argv['code-version']
    })

    uploader.mapFiles(scanner.files);

    await uploader.upload(argv['dry-run']);

  }
}
