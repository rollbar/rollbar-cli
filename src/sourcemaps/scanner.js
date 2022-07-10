'use strict';

const fs = require('fs');
const glob = require('glob');
const path = require('path');
const BasicSourceMapConsumer = require('source-map/lib/source-map-consumer').BasicSourceMapConsumer;

class Scanner {
  constructor(options) {
    this.files = [];
    this.mappings = {};
    this.targetPath = options.targetPath;
    this.projectPath = './';
    this.sources = options.sources;
  }

  async scan() {
    await this.scanFiles();
  }

  async scanFiles() {
    if (this.targetPath) {
      this.files = this.targetFiles();
    }

    for (const file of this.files) {
      output.status('Found', file.filePathName);

      this.extractMapPath(file);
      await this.loadMapData(file);

      for(const error of file.errors) {
        output.warn('Error', error.error);
      }
    }
    output.verbose('files:', this.files);
  }

  extractMapPath(file) {
    // check sourceMappingURL to see if a map is defined
    const mapPath = this.parseMapPath(file.filePathName);
    if (mapPath) {
      output.status('', mapPath);
      file.mapPathName = mapPath;
      file.sourceMappingURL = true;
      file.mappedFile = path.join(this.targetPath, mapPath);
      return;
    }

    // check to see if the file exists locally
    const localPath = this.localMapPath(file.filePathName);
    if (localPath) {
      output.status('', localPath);
      file.mapPathName = localPath;
      file.sourceMappingURL = false;
      file.mappedFile = path.join(this.targetPath, localPath);
      return;
    }

    output.warn('', 'map not found');
  }

  async loadMapData(file) {
    if (file.mapPathName) {
      try {
        const filePath = path.dirname(file.filePathName);
        const mapPath = path.resolve(filePath, file.mapPathName);
        const data = fs.readFileSync(mapPath).toString();

        if (data) {
          file.mapData = data;
          file.map = JSON.parse(file.mapData);
          file.sources = (this.sources && file.map.sources) ? await this.originalSources(file) : {};
          const errors = await this.validate(file);
          if (errors && errors.length) {
            file.errors.push(...errors);
          } else {
            file.validated = true;
          }
        } else {
          output.warn('', 'map data not valid');
        }

        if (file.validated) {
          output.success('', 'valid');
        } else {
          output.warn('', 'map not valid');
        }

      } catch (e) {
        file.errors.push({
          error: 'Error parsing map file: ' + e.message,
          file: file
        });
      }
    }
  }

  async originalSources(file) {
    const map = file.map;
    const filenames = map.sources;
    const sources = {};

    output.status('', `${filenames.length} original sources`);

    const consumer = await new BasicSourceMapConsumer(map);

    for (const filename of filenames) {
      if (filename) {
        if (filename.includes('.') && !filename.startsWith('..')) {
          const filepath = path.join(this.projectPath, filename);
          output.verbose(filepath);
          try {
            output.verbose('', filename);
            sources[filename] = consumer.sourceContentFor(filepath, true);
          } catch (e) {
            output.warn('', e.message);
            file.errors.push({
              error: e.message,
              file: file
            });
          }
        } else {
          // Avoid known issues with names Rollbar API doesn't accept.
          output.verbose('', 'Ignored: ' + filename);
        }
      }
    }

    return sources;
  }

  async validate(file) {
    const map = file.map;
    const errors = [];

    file.metadata.version =  map.version;
    file.metadata.file =  map.file;
    if (map.sections) {
      file.metadata.sections = map.sections.length;
    }

    if (map.sources) {
      file.metadata.sources = map.sources;
    }

    // For now, validation is lightweight and just answers the question:
    // Is this a valid source map at all?
    // BasicSourceMapConsumer will complain if not, so load it up and see if it throws.
    try {
      await new BasicSourceMapConsumer(map);
    } catch (e) {
      errors.push({
        error: 'Error parsing map file: ' + e.message,
        file: file
      });
    }

    return errors;
  }

  mappedFiles() {
    return this.files;
  }

  targetFiles() {
    const globPath = path.join(this.targetPath, '**/*.js');
    const outFiles = [];

    const files = glob.sync(globPath);
    for (const filename of files) {
      outFiles.push(this.initFile(filename));
    }

    return outFiles;
  }

  initFile(filePathName) {
    return {
      filePathName: filePathName,
      fileName: path.relative(this.targetPath, filePathName),
      sourceMappingURL: false,
      mapPathName: null,
      mapData: null,
      validated: false,
      metadata: {},
      errors: []
    }
  }

  parseMapPath(path) {
    const regex = /^\s*\/\/#\s*sourceMappingURL\s*=\s*(.+)\s*$/;
    const data = fs.readFileSync(path).toString();
    const lines = data.split('\n').reverse();

    for (const line of lines) {
      const matched = line.match(regex);
      if (matched) {
        return matched[1];
      }
    }
  }

  localMapPath(sourcePath) {
    const mapPath = sourcePath + '.map';
    const stat = fs.statSync(mapPath, { throwIfNoEntry: false });
    return stat && stat.isFile() ? path.basename(mapPath) : undefined;
  }
}

module.exports = Scanner;
