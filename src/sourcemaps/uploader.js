'use strict';

const AdmZip = require('adm-zip');
const RollbarAPI = require('../common/rollbar-api');
const URL = require('url').URL;
const path = require('path');

class Uploader {
  constructor(options) {
    this.files = [];
    this.rollbarAPI = new RollbarAPI(options.accessToken);
    this.baseUrl = options.baseUrl;
    this.version = options.codeVersion;
  }

  mapFiles(files) {
    this.files = files;

    return this;
  }

  zipFiles(targetPath) {
    const zipFile = new AdmZip();
    const fs = require('fs');

    for (const file of this.files) {
      //output.status('Upload', file);
      zipFile.addLocalFile(file.filePathName);
    }
    const outFile = path.join(targetPath, 'output.zip');
    fs.writeFileSync(outFile, zipFile.toBuffer());
  }

  async upload(dryRun) {
    if (dryRun) {
      // TODO: Maybe more can be done here, but the important part is just to
      // return without sending. The bulk of validation is done earlier
      // in the scanning phase.
      return this.files;
    }

    for (const file of this.files) {
      output.status('Upload', file.mapPathName);

      try {
        if (this.skip(file)) {
          continue;
        }

        const error = await this.rollbarAPI.sourcemaps(this.buildRequest(file));

        if (error) {
          file.errors.push({
            error: error.message,
            file: file
          });
        }
      } catch (e) {
        file.errors.push({
          error: e.message,
          file: file
        });
      }

      if (!file.errors.length) {
        output.success('', 'Upload successful');
      }

      for (const error of file.errors) {
        output.error('Error', error.error);
      }
    }

    return this.files;
  }

  buildRequest(file) {
    return {
      version: this.version,
      minified_url: this.minifiedUrl(file.fileName),
      source_map: file.mapData,
      sources: file.sources
    }
  }

  minifiedUrl(fileName) {
    return (new URL(fileName, this.baseUrl)).toString();
  }

  skip(file) {
    if (file.fileName && file.mapData && !file.errors.length){
      return false;
    }

    output.warn('', 'skip: ' + file.filePathName);

    return true;
  }
}

module.exports = Uploader;
