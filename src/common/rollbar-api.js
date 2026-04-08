'use strict';

// Helper to normalize axios error/response for consistent error handling
function normalizeAxiosError(resp) {
  if (!resp) return { statusText: 'Axios Error', message: 'Unknown error' };
  if (resp.status === 200) return null;
  if (typeof resp.data === 'string') {
    return { statusText: resp.statusText || 'Axios Error', message: resp.data };
  }
  if (typeof resp.data === 'object' && resp.data !== null) {
    return Object.assign({}, resp.data, { statusText: resp.statusText || 'Axios Error' });
  }
  return { statusText: resp.statusText || 'Axios Error', message: String(resp.data) };
}

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
    try {
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
    } catch (error) {
      output.verbose('', 'axios threw error:', error);
      return this.processResponse(error.response || { data: error.message, status: error.status || 500, statusText: error.statusText || 'Axios Error' });
    }
  }

  async sigendURLsourcemaps(request) {
    try {
      const resp = await this.axios.post(
        '/signed_url/sourcemap_bundle',  { version: request.version , prefix_url: request.baseUrl}
      );
      return this.processSignedURLResponse(resp);
    } catch (error) {
      output.verbose('', 'axios threw error:', error);
      return this.processSignedURLResponse(error.response || { data: error.message, status: error.status || 500, statusText: error.statusText || 'Axios Error' });
    }
  }

  async sourcemaps(request) {
    output.verbose('', 'minified_url: ' + request.minified_url);

    const form = this.convertRequestToForm(request);
    try {
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
    } catch (error) {
      output.verbose('', 'axios threw error:', error);
      return this.processResponse(error.response || { data: error.message, status: error.status || 500, statusText: error.statusText || 'Axios Error' });
    }
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
    if (resp.status === 200) {
      return resp.data;
    }
    return normalizeAxiosError(resp);
  }

  processResponse(resp) {
    output.verbose('', 'response:', resp.data, resp.status, resp.statusText);
    return normalizeAxiosError(resp);
  }
}

module.exports = RollbarAPI;
