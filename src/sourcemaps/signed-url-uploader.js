'use strict';

const AdmZip = require('adm-zip');
const axios = require('axios');
const zipFile = new AdmZip();

class SignedUrlUploader {
  constructor(requester) {
     this.zippedMapFile = '';
     this.files = [];
     this.requester = requester;
     this.zipBuffer = Buffer;

  }

  mapFiles(files) {
    this.files = files;

    return this;
  }

  zipFiles() {

    try {
      zipFile.addFile('manifest.json', this.requester.manifestData);
    } catch (e) {
      output.status('Error', e.message);
    }
      for (const file of this.files) {
        try {
          if (file.validated) {
            zipFile.addLocalFile(file.mappedFile);
          }
        } catch(e) {
          output.status('Error', e.message);
        }
      }
      try {
        this.zipBuffer = zipFile.toBuffer();
        if (this.zipBuffer.length != 0) {
          output.success('', 'Zipped all the source map files successfully');
        } else {
          output.error('', 'Zip was unsuccessful');
        }
      } catch(e) {
        output.status('Error', e.message);
      }
  }

  async upload(dryRun, files, signedUrl) {
    if (dryRun) {
      // TODO: Maybe more can be done here, but the important part is just to
      // return without sending. The bulk of validation is done earlier
      // in the scanning phase.
      return this.files;
    }

    try {
      this.mapFiles(files);
      this.zipFiles();

      const resp = await axios.put(signedUrl, this.zipBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      })
      if (resp.status === 200) {
        output.status('Success', 'Uploaded zip file successfully');
      } else {
        output.status('Error', 'Could not upload the zip file');
      }

    }  catch (e) {
      output.status('Error', e.message);
    }
  }
}

module.exports = SignedUrlUploader;
