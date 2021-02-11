'use strict';

const RollbarAPI = require('../common/rollbar-api');
const URL = require('url').URL;

class Requester {
  constructor(options) {
    this.rollbarAPI = new RollbarAPI(options.accessToken);
    this.baseUrl = options.baseUrl;
    this.version = options.codeVersion;
  }

  async requestSignedUrl(dryRun) {
    if (dryRun) {
      // TODO: Maybe more can be done here, but the important part is just to
      // return without sending. The bulk of validation is done earlier
      // in the scanning phase.
      return this
    }

    try {
      const error = await this.rollbarAPI.sourcemaps(this.buildRequest());
      if (error) {
        output.error('Error', error.error);
      } else {
        output.success('', 'Requested successfully');
      }
    } catch (e) {
      output.error('Error', e.message);
    }

    return this.files;
  }

  buildRequest() {
    return {
      version: this.version,
      baseUrl: this.baseUrl,
    }
  }

}

module.exports = Requester;
