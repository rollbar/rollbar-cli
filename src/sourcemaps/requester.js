'use strict';

const RollbarAPI = require('../common/rollbar-api');

class Requester {
  constructor(options) {
    this.data = null;
    this.rollbarAPI = new RollbarAPI(options.accessToken);
    this.baseUrl = options.baseUrl;
    this.version = options.codeVersion;
    this.projectID = 0;
    this.dryRun = options.dryRun;
    this.manifestData = '';
  }

  async requestSignedUrl() {
    if (this.dryRun) {
      // TODO: Maybe more can be done here, but the important part is just to
      // return without sending. The bulk of validation is done earlier
      // in the scanning phase.
      return this;
    }

    try {
      const data = await this.rollbarAPI.sigendURLsourcemaps(this.buildRequest());

      this.data = data;
      if (data && data['err'] === 0) {
        output.success('', 'Requested for signed URL successfully');
      } else {
        output.error('Error', data.message);
      }

    } catch (e) {
      output.error('Error', e.message);
    }
  }

  buildRequest() {
    return {
      version: this.version,
      baseUrl: this.baseUrl,
    };
  }

  setProjectID() {
    this.projectID = this.data['result']['project_id'];
  }

  createManifestData() {
    const data = {
      projectID: this.projectID,
      version: this.version,
      baseUrl: this.baseUrl,
    };

    const strData = JSON.stringify(data, null, 2);
    this.manifestData = strData;
  }
}

module.exports = Requester;
