'use strict';

const RollbarAPI = require('../common/rollbar-api');

class Deployer {
  constructor(options) {
    this.rollbarAPI = new RollbarAPI(options.accessToken);
    this.name = options.name;
  }

  async createProject() {
    let error;
    try {
      error = await this.rollbarAPI.createProject(this.buildRequest());
    } catch (e) {
      error = e.message;
    }

    if (error)
      output.error('Error', error);
    else
      output.success('','Create project successful');
  }

  buildRequest() {
    return {
      name: this.name
    }
  }
}

module.exports = Deployer;
