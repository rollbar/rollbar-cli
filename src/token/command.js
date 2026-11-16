'use strict';

const chalk = require('chalk');
const { publicIdFromToken, TokenFormatError } = require('./public-id');
const { readSecret, SecretInputError, PromptCancelled } = require('./read-secret');

const PROMPT = 'Rollbar access token: ';

// The global options. Anything else on the command line might be the token.
const ALLOWED_KEYS = ['_', '$0', 'v', 'verbose', 'q', 'quiet', 'help', 'version'];

// It doesn't repeat what was on the command line: that might be the token.
const REFUSAL = 'token-public-id takes no arguments, and didn\'t read a token from them. ' +
  'If you typed the token on the command line, it may now be in your shell history; consider rotating it. ' +
  'Pipe the token to stdin, or run the command with no arguments to be prompted for it.';

exports.command = 'token-public-id';

exports.describe = 'Print the public ID of a Rollbar access token';

exports.builder = function (yargs) {
  return yargs
    .example('$0 token-public-id', 'Prompt for the token')
    .example('$0 token-public-id < token.txt', 'Read the token from a file')
    .example('pbpaste | $0 token-public-id', 'Read the token from the clipboard (macOS)')
    .epilogue('The token is read from stdin when it\'s piped or redirected, or else from a prompt that ' +
      'doesn\'t echo it. It can\'t be given as an argument, which would leave it in your shell history. ' +
      'The public ID is printed to stdout, and warnings and errors to stderr. Nothing is sent over the network.');
};

function tokenOnCommandLine(argv) {
  return argv._.length > 1 || Object.keys(argv).some(function (key) {
    return ALLOWED_KEYS.indexOf(key) === -1;
  });
}

function errorMessage(err) {
  if (err instanceof TokenFormatError || err instanceof SecretInputError || err instanceof PromptCancelled) {
    return err.message;
  }

  // Anything else is from Node, and isn't known to leave the input out of its message.
  const code = err && err.code ? ` (${err.code})` : '';
  return `Couldn't read the access token${code}.`;
}

/**
 * Runs the command with the given streams, and returns its exit code: 0 once the
 * public ID is printed, 1 when there's no valid token to read, and 130 when the
 * prompt is cancelled with Ctrl-C.
 */
async function run(argv, io) {
  if (tokenOnCommandLine(argv)) {
    io.stderr.write(chalk.stderr.red(REFUSAL) + '\n');
    return 1;
  }

  let input = null;
  try {
    input = await readSecret({ stdin: io.stdin, stderr: io.stderr, prompt: PROMPT });
    const result = publicIdFromToken(input);

    result.warnings.forEach(function (warning) {
      io.stderr.write(chalk.stderr.yellow(`Warning: ${warning}`) + '\n');
    });
    if (argv.verbose) {
      io.stderr.write(`Token type: ${result.type}\n`);
    }

    io.stdout.write(result.publicId + '\n');
    return 0;
  } catch (err) {
    io.stderr.write(chalk.stderr.red(errorMessage(err)) + '\n');
    return err instanceof PromptCancelled ? 130 : 1;
  } finally {
    if (input) {
      input.fill(0);
    }
  }
}

exports.run = run;

exports.handler = async function (argv) {
  process.exitCode = await run(argv, {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr
  });
};
