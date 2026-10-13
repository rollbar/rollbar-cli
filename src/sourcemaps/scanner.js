'use strict';

const fs = require('fs');
const glob = require('glob');
const path = require('path');
const BasicSourceMapConsumer = require('source-map/lib/source-map-consumer').BasicSourceMapConsumer;

// Besides .js, React Native bundles are main.jsbundle (iOS) and index.android.bundle (Android).
const BUNDLE_GLOB = '**/*.{js,jsbundle,bundle}';
const RN_BUNDLE_REGEX = /\.(jsbundle|bundle)$/;
const MAP_REGEX = /\.map$/;

class Scanner {
  constructor(options) {
    this.files = [];
    this.mappings = {};
    this.targetPath = options.targetPath;
    // <path> may be a build directory, a single bundle file or a single .map file.
    this.targetIsFile = !!this.targetPath && fs.existsSync(this.targetPath) &&
      fs.statSync(this.targetPath).isFile();
    this.basePath = this.targetIsFile ? path.dirname(this.targetPath) : this.targetPath;
    this.projectPath = './';
    this.sources = options.sources;
  }

  async scan() {
    await this.scanFiles();
  }

  async scanFiles() {
    if (this.targetPath) {
      this.files = this.targetFiles();

      if (!this.files.length) {
        output.warn('', 'no .js, .jsbundle or .bundle files found at ' + this.targetPath);
      }
    }

    for (const file of this.files) {
      output.status('Found', file.filePathName);

      this.extractMapPath(file);
      await this.loadMapData(file);

      for(const error of file.errors) {
        output.warn('Error', error.error);
      }
    }

    this.warnDuplicateNames();
    output.verbose('files:', this.files);
  }

  warnDuplicateNames() {
    const pathsByName = {};

    for (const file of this.files) {
      if (file.validated) {
        (pathsByName[file.fileName] = pathsByName[file.fileName] || []).push(file.filePathName);
      }
    }

    for (const [fileName, paths] of Object.entries(pathsByName)) {
      if (paths.length > 1) {
        output.warn('', `${paths.length} maps upload as ${fileName}, so only one can apply: ${paths.join(', ')}`);
      }
    }
  }

  extractMapPath(file) {
    let mapPath;

    if (MAP_REGEX.test(file.filePathName)) {
      // <path> is the map itself, e.g. a Hermes build's index.android.bundle.map.
      mapPath = path.basename(file.filePathName);
    } else {
      mapPath = this.parseMapPath(file.filePathName);

      if (mapPath) {
        file.sourceMappingURL = true;
      } else if (RN_BUNDLE_REGEX.test(file.filePathName)) {
        // Hermes bytecode bundles have no sourceMappingURL directive.
        mapPath = this.adjacentMapPath(file.filePathName);
      }
    }

    if(mapPath) {
      output.status('', mapPath);
      file.mapPathName = mapPath;
      file.mappedFile = path.join(path.dirname(file.filePathName), mapPath);

    } else {
      output.warn('', 'map not found');
    }
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
    if (this.targetIsFile) {
      return [this.initFile(this.targetPath)];
    }

    const globPath = path.join(this.targetPath, BUNDLE_GLOB);
    const outFiles = [];

    const files = glob.sync(globPath, { nodir: true });
    for (const filename of files) {
      outFiles.push(this.initFile(filename));
    }

    return outFiles;
  }

  initFile(filePathName) {
    // A .map uploads for the bundle it is named after: main.jsbundle.map -> main.jsbundle.
    let fileName = path.relative(this.basePath, filePathName).replace(MAP_REGEX, '');

    // React Native frames are http://reactnativehost/<bundle name>, without any build
    // directory, so a bundle found in a subdirectory still uploads under its own name.
    if (RN_BUNDLE_REGEX.test(fileName)) {
      fileName = path.basename(fileName);
    }

    return {
      filePathName: filePathName,
      fileName: fileName,
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

  adjacentMapPath(filePathName) {
    const mapName = path.basename(filePathName) + '.map';

    if (fs.existsSync(path.join(path.dirname(filePathName), mapName))) {
      return mapName;
    }
  }
}

module.exports = Scanner;
