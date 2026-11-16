'use strict';

const chalk = require('chalk');
const { SafeMessageError } = require('./errors');
const { publicIdFromToken } = require('./public-id');
const { readSecret, PromptCancelled } = require('./read-secret');

const PROMPT = 'Rollbar access token: ';

// The options the command line may have, all flags. chalk reads --color and
// --colors from process.argv itself. Anything else on the command line might be
// the token.
const FLAGS = ['v', 'verbose', 'q', 'quiet', 'h', 'help', 'version', 'color', 'colors'];
const COLOR_FLAGS = ['color', 'colors'];
// The values chalk takes for --color=, other than a flag's true and false.
const COLOR_VALUES = ['true', 'false', 'always', 'never', '256', '16m', 'full', 'truecolor'];

// A run of hex as long as the shortest token.
const TOKEN_LIKE = /[0-9a-f]{32}/i;

// The refusal doesn't repeat what was on the command line: that might be the token.
const REFUSAL = 'token-public-id takes no arguments, and didn\'t read a token from them.';
const ROTATE = 'If you typed the token on the command line, it may now be in your shell history; consider rotating it.';
const HOW_TO = 'Pipe the token to stdin, or run the command with no arguments to be prompted for it.';

exports.command = 'token-public-id';

exports.describe = 'Print the public ID of a Rollbar access token';

exports.builder = function (yargs) {
  return yargs
    .alias('h', 'help')
    .example('$0 token-public-id', 'Prompt for the token')
    .example('$0 token-public-id < token.txt', 'Read the token from a file')
    .example('pbpaste | $0 token-public-id', 'Read the token from the clipboard (macOS)')
    .epilogue('The token is read from stdin when it\'s piped or redirected, or else from a prompt that ' +
      'doesn\'t echo it. It can\'t be given as an argument, which would leave it in your shell history. ' +
      'The public ID is printed to stdout, and warnings and errors to stderr. Nothing is sent over the network.');
};

function isAllowed(key, value) {
  if (key === '_' || key === '$0') {
    return true;
  }
  if (FLAGS.indexOf(key) === -1) {
    return false;
  }
  return typeof value === 'boolean' ||
    (COLOR_FLAGS.indexOf(key) !== -1 && COLOR_VALUES.indexOf(String(value)) !== -1);
}

function hasArguments(argv) {
  return argv._.length > 1 || Object.keys(argv).some(function (key) {
    return !isAllowed(key, argv[key]);
  });
}

// Whether any word on the command line has a run of hex as long as a token.
// Only then is the token likely to have been typed there.
function hasTokenLikeArgument(args) {
  return args.some(function (arg) {
    return TOKEN_LIKE.test(arg);
  });
}

function errorMessage(err) {
  if (err instanceof SafeMessageError) {
    return err.message;
  }

  // Anything else is from Node, and isn't known to leave the input out of its message.
  const code = err && err.code ? ` (${err.code})` : '';
  return `Couldn't read the access token${code}.`;
}

/**
 * Runs the command with the given streams, and returns its exit code: 0 once the
 * public ID is printed, 1 when there's no valid token to read, and 130 when the
 * prompt is cancelled with Ctrl-C. --quiet leaves out the warnings and the
 * --verbose token type, but not errors.
 *
 * `argv` is the command line as yargs parsed it, and `args` is the command line
 * as typed, after node and the script. Both are checked for a token: yargs reads
 * text joined to a flag, as in --verbose=<token>, as false, which leaves no
 * trace of it in `argv`.
 */
async function run(argv, io, args) {
  const tokenLike = hasTokenLikeArgument(args);
  if (tokenLike || hasArguments(argv)) {
    const refusal = tokenLike ? `${REFUSAL} ${ROTATE} ${HOW_TO}` : `${REFUSAL} ${HOW_TO}`;
    io.stderr.write(chalk.stderr.red(refusal) + '\n');
    return 1;
  }

  let input = null;
  try {
    input = await readSecret({ stdin: io.stdin, stderr: io.stderr, prompt: PROMPT });
    const result = publicIdFromToken(input);

    if (!argv.quiet) {
      result.warnings.forEach(function (warning) {
        io.stderr.write(chalk.stderr.yellow(`Warning: ${warning}`) + '\n');
      });
      if (argv.verbose) {
        io.stderr.write(`Token type: ${result.type}\n`);
      }
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
  }, process.argv.slice(2));
};
