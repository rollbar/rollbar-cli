'use strict';

const RollbarAPI = require('../common/rollbar-api');
const URL = require('url').URL;

class Deployer {
  constructor(options) {
    this.rollbarAPI = new RollbarAPI(options.accessToken);
    this.version = options.codeVersion;
    this.deploy_id = options.deployId;
    this.env = options.environment;
    this.status = options.status;
    this.username = options.username;
  }

  async deploy() {
    let error;
    try {
      error = await this.rollbarAPI.deploy(this.buildRequest(), this.deploy_id);
    } catch (e) {
      error = e.message
    }

    if (error)
      output.error('Error', error);
    else
      output.success('','Deploy successful');
  }

  buildRequest() {
    return {
      revision: this.version,
      environment: this.env,
      status: this.status,
      username: this.username
    }
  }
}

module.exports = Deployer;
