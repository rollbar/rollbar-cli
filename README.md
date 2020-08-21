# rollbar-cli

The Rollbar CLI provides easy command line access to Rollbar's API features,
starting with source map uploads.

## Usage and Reference
Currently the upload-sourcemaps command is supported.

### upload-sourcemaps
Upload source maps recursively from a directory.

```
rollbar-cli upload-sourcemaps <path> [options]

upload sourcemaps

Options:
  --version       Show version number                                  [boolean]
  -v, --verbose   Verbose status output                                [boolean]
  -q, --quiet     Silent status output                                 [boolean]
  --help          Show help                                            [boolean]
  --access-token  Access token for the Rollbar API           [string] [required]
  --url-prefix    Base part of the stack trace URLs          [string] [required]
  --code-version  Code version string must match value in the Rollbar item
                                                             [string] [required]
  -D, --dry-run   Scan and validate source maps without uploading      [boolean]
```

Example:
```
rollbar-cli upload-sourcemaps ./dist -access-token 638d... --url-prefix 'http://example.com/' --code-version 123.456
```


## Release History & Changelog

See our [Releases](https://github.com/rollbar/rollbar-cli/releases) page for a list of all releases, including changes.

## Help / Support

If you run into any issues, please email us at [support@rollbar.com](mailto:support@rollbar.com).

For bug reports, please [open an issue on GitHub](https://github.com/rollbar/rollbar-cli/issues/new).

## Developing

To set up a development environment, you'll need Node.js and npm.

1. Install dependencies
`npm install`

2. Link the rollbar-cli command to the local repo
`npm link`

3. Run the tests
`npm test`

## Contributing

1. [Fork it](https://github.com/rollbar/rollbar-cli).
2. Create your feature branch (`git checkout -b my-new-feature`).
3. Commit your changes (`git commit -am 'Added some feature'`).
4. Push to the branch (`git push origin my-new-feature`).
5. Create a new Pull Request.
