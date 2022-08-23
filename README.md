# rollbar-cli

The Rollbar CLI provides easy command line access to Rollbar's API features,
starting with source map uploads and notifying deploys.

![build](https://github.com/rollbar/rollbar-cli/workflows/Node.js%20CI/badge.svg)

## Install

```
npm install -g rollbar-cli
```

## Usage and Reference
Currently upload-sourcemaps and notify-deploy commands are supported.

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
  --next          Next version. Zip all the source map files and upload as one
                  file                                                 [boolean]
  -D, --dry-run   Scan and validate source maps without uploading      [boolean]
```

Some of these options are required and must be specified for a successful upload.

`path`: Absolute or relative path to build directory. This directory should contain .js
files with `sourceMappingURL` directives included. The current version of the CLI
supports detecting files with `sourceMappingURL` directives and uploading related
map files within a directory.

`--access-token`: The Rollbar API `post_server_item` token.

`--url-prefix`: The base portion of the URL to be concatenated with the js filenames
discovered while scanning `path`. The Rollbar backend uses this to match stack frame locations
and it must exactly match the URLs in the error stack frames. See `minified_url` at
[Source Maps](https://docs.rollbar.com/docs/source-maps) for more information.

`--code-version`: The code version string must match the string passed in the Rollbar
error payload, which is usually set in the config options for Rollbar.js.
See [Source Maps](https://docs.rollbar.com/docs/source-maps) for more information.

`--next`: This is an optional parameter triggering next version. When specified, all source map files
are compressed and uploaded as one zip file directly.

Example:
```
rollbar-cli upload-sourcemaps ./dist --access-token 638d... --url-prefix 'http://example.com/' --code-version 123.456
```
or
```
rollbar-cli upload-sourcemaps ./dist --access-token 638d... --url-prefix 'http://example.com/' --code-version 123.456 --next
```

### notify-deploy
Notify deploy to Rollbar.

```
rollbar-cli notify-deploy [options]

Notify deploy to Rollbar

Options:
  --version           Show version number                              [boolean]
  -v, --verbose       Verbose status output                            [boolean]
  -q, --quiet         Silent status output                             [boolean]
  --help              Show help                                        [boolean]
  --access-token      Use a post server item access token for the Rollbar API
                                                             [string] [required]
  --code-version      Code version or Git SHA of revision being deployed
                                                             [string] [required]
  --deploy-id         ID of the deploy to update                        [string]
  --environment       Environment to which the revision was deployed such as
                      production                             [string] [required]
  --status            Status of the deploy - started, succeeded (default),
                      failed, or timed_out                              [string]
  --rollbar-username  Rollbar username of person who deployed           [string]
  --local-username    Local username of person who deployed             [string]
  --comment           Additional text to include with the deploy        [string]
```

Example:
```
rollbar-cli notify-deploy --access-token 1234 --code-version 1.0.1 --environment production --rollbar-username foobar --status succeeded --local-username foo_bar --comment 'Deploy Test'
```

Output on success:
```
         { deploy_id: 12345678 }
         Deploy successful
```

### create-project
Create a new Rollbar project.

```
rollbar-cli create-project [options]

Create a new Rollbar project

Options:
  --version           Show version number                              [boolean]
  -v, --verbose       Verbose status output                            [boolean]
  -q, --quiet         Silent status output                             [boolean]
  --help              Show help                                        [boolean]
  --access-token      Use an Account Access Token with 'write' scope
                                                             [string] [required]
  --name              Name of the project. Must start with a letter; can contain letters, numbers, spaces, underscores, hyphens, periods, and commas. Max length 32 characters.
                                                             [string] [required]
```

Example:
```
rollbar-cli create-project --access-token 1234 --name TestProject
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

## License

rollbar-cli is free software released under the MIT License. See LICENSE for details.
