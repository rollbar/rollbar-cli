'use strict';

const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs')
const axios = require('axios')
const zipFile = new AdmZip();

class SignedUrlUploader {
  constructor() {
     this.zippedMapFile = ''
     this.files = []
  }

  mapFiles(files) {
    this.files = files;

    return this;
  }

  zipFiles(targetPath, filename, manifest) {

    try {
      zipFile.addLocalFile(manifest);
    } catch (e) {
      output.status('Error', e.message)
    }
      for (const file of this.files) {
        try {
          if (file.validated) {
            zipFile.addLocalFile(file.mappedFile);
          }
        } catch(e) {
          output.status('Error', e.message)
        }
      }
      try {
        const outFile = path.join(targetPath, filename);
        fs.writeFileSync(outFile, zipFile.toBuffer());

        const fileSize = fs.statSync(outFile);

        if (fileSize['size'] > 0) {
          this.zippedMapFile = outFile
          output.success('', 'Zipped all the source map files successfully');
        } else {
          output.success('', 'Zip was unsuccessful');
        }
      } catch(e) {
        output.status('Error', e.message)
      }
  }

  async upload(dryRun, signedUrl) {
    if (dryRun) {
      // TODO: Maybe more can be done here, but the important part is just to
      // return without sending. The bulk of validation is done earlier
      // in the scanning phase.
      return this.files;
    }

    try {
      const readmeStream = fs.createReadStream(this.zippedMapFile)

      const resp = await axios.put(signedUrl, readmeStream, {
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
      output.status('Error', e.message)
    }
  }
}

module.exports = SignedUrlUploader;
