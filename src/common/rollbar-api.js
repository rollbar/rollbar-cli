'use strict';
var https = require('https');

const axios = require('axios');


class RollbarAPI {
  constructor(accessToken) {
    this.accessToken = accessToken;

    this.axios = axios.create({
      baseURL: 'https://127.0.0.1/api/1/',
      //baseURL: 'https://api.rollbar.com/api/1/',
      headers: { 'X-Rollbar-Access-Token': accessToken },
      // Always resolve, regardless of status code.
      // When we let axios reject, we end up with less specific error messages.
      validateStatus: function (_status) { return true; },
      // Let axios send anything, and let the API decide what the max length should be.
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  }

  async deploy(request, deployId) {
    let resp;
    if(deployId) {
      output.verbose('', 'Update to an existing deploy with deploy_id: ' + deployId);
      resp = await this.axios.patch('/deploy/' + deployId, request);
    } else {
      output.verbose('','deploy_id not present so likely a new deploy');
      resp = await this.axios.post('/deploy', request);
    }

    // Output deploy-id
    if (resp.status === 200) {
      output.success('', resp.data.data);
    }
    return this.processDeployResponse(resp);
  }

  async sourcemaps(request) {

    const json = JSON.stringify({ version: request.version , prefix_url: request.baseUrl});

    const resp = await this.axios.post(
      '/signed_url/sourcemaps', json,
        {
          httpsAgent: new https.Agent({
            rejectUnauthorized: false
          }),
          headers: {
            // axios needs some help with headers for form data.
            'Content-Type': 'application/json'
          }
        },
    );
    return this.processSourceMapResponse(resp);
  }

  processSourceMapResponse(resp) {
    output.verbose('', 'response:', resp.data, resp.status, resp.statusText);
    return resp.data;
  }

  processDeployResponse(resp) {
    output.verbose('', 'response:', resp.data, resp.status, resp.statusText);
    if (resp.status === 200) {
      return null
    }
    return resp.data;
  }
}

module.exports = RollbarAPI;
