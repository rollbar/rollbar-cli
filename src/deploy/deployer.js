'use strict';

const RollbarAPI = require('../common/rollbar-api');
const URL = require('url').URL;

class Deployer {
  constructor(options) {
    this.rollbarAPI = new RollbarAPI(options.accessToken);
    this.version = options.codeVersion;
    this.deploy_id = options.deployId;
    this.environment = options.environment;
    this.status = options.status;
    this.rollbar_username = options.rollbarUsername;
    this.local_username = options.localUsername;
    this.comment = options.comment;
  }

  async deploy() {
    let error;
    try {
      error = await this.rollbarAPI.deploy(this.buildRequest(), this.deploy_id);
    } catch (e) {
      error = e.message;
    }

    if (error)
      output.error('Error', error);
    else
      output.success('','Deploy successful');
  }

  buildRequest() {
    return {
      revision: this.version,
      environment: this.environment,
      status: this.status,
      rollbar_username: this.rollbar_username,
      local_username: this.local_username,
      comment: this.comment
    }
  }
}

module.exports = Deployer;
