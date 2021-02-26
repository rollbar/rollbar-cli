'use strict';
const axios = require('axios');
const FormData = require('form-data');

class RollbarAPI {
  constructor(accessToken) {
    this.accessToken = accessToken;

    this.axios = axios.create({
      baseURL: 'https://api.rollbar.com/api/1/',
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
    return this.processResponse(resp);
  }

  async sigendURLsourcemaps(request) {

    const json = JSON.stringify({ version: request.version , prefix_url: request.baseUrl});

    const resp = await this.axios.post(
      '/signed_url/sourcemaps', json,
      { headers: {
        // axios needs some help with headers for form data.
        'Content-Type': 'application/json'
      }},
    );
    return this.processSignedURLResponse(resp);
  }

  async sourcemaps(request) {
    output.verbose('', 'minified_url: ' + request.minified_url);

    const form = this.convertRequestToForm(request);
    const resp = await this.axios.post(
      '/sourcemap',
      form.getBuffer(), // use buffer to prevent unwanted string escaping.
       { headers: {
         // axios needs some help with headers for form data.
         'Content-Type': `multipart/form-data; boundary=${form.getBoundary()}`,
         'Content-Length': form.getLengthSync()
      }}
    );

    return this.processResponse(resp);
  }

  convertRequestToForm(request) {
    const form = new FormData();

    form.append('version', request.version);
    form.append('minified_url', request.minified_url);
    form.append('source_map', Buffer.from(request.source_map), { filename: 'source_map' });

    if (request.sources) {
      for (const filename of Object.keys(request.sources)) {
        if (filename && request.sources[filename]) {
          form.append(filename, Buffer.from(request.sources[filename]), { filename: filename });
        }
      }
    }
    return form;
  }

  processSignedURLResponse(resp) {
    output.verbose('', 'response:', resp.data, resp.status, resp.statusText);
    return resp.data;
  }

  processResponse(resp) {
    output.verbose('', 'response:', resp.data, resp.status, resp.statusText);
    if (resp.status === 200) {
      return null;
    }
    return resp.data;
  }
}

module.exports = RollbarAPI;
