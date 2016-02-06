'use strict'
var config = require('./config.json');

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var gm = require('gm');
var os = require('os');
var highland = require('highland');
var elasticsearch = require('elasticsearch');
var mkdirp = require('mkdirp');
var file = require('file');
var express = require('express');

var Promise = require('bluebird');
Promise.promisifyAll(fs);

var ESclient;

module.exports = {
  connectToES: connectToES,
  isValidPicturePath: isValidPicturePath,
  createThumbnailDir: createThumbnailDir,
  resizeImage: resizeImage,
  createMetadata: createMetadata,
  isPicture: isPicture,
  createHash: createHash,
  getFilenamesFromDir: getFilenamesFromDir,
  processFileDir: processFileDir,
  processFile: processFile,
  createThumbnail: createThumbnail,
  writeFile: writeFile,
  createIndex: createIndex,
  deleteIndex: deleteIndex,
  createOrUpdateDocument: createOrUpdateDocument,
  getDocumentById: getDocumentById,
};

(function main() {
  ESclient = connectToES(config);

  if (isValidPicturePath(config.pictureDir)) {
    startService();
  } else {
    console.error(config.pictureDir, ' does not look like a valid directory to process. Please specify a different directory of images to process.');
  }

  function startService() {
    var app = express();
    app.use(express.static('assets'));

    app.get('/test', (req, res) => res.send('Up and running'));

    app.get('/picturedir', (req, res) => res.json({
      path: path.resolve(config.pictureDir),
    }));

    app.get('/filelist', sendFileListRequest);

    app.get('/process', processDirRequest);

    var server = app.listen(3000, function () {
      var host = server.address().address;
      var port = server.address().port;

      console.log('Web server and API listening at http://', host, port, '\n');
    });
  }

})();

function connectToES(config) {
  ESclient = new elasticsearch.Client({
    host: config.elasticsearch.connectParams,
    log: 'trace',
  });

  return ESclient;
}

function isValidPicturePath(pictureDir) {
  try {
    var stats = fs.lstatSync(path.resolve(pictureDir));
    console.log('Is existing directory:', stats.isDirectory(), '\n');
    return stats.isDirectory() ? true : false;
  } catch (err) {
    console.error('Something went wrong checking for configurated directory', pictureDir, ', please specify a valid directory in the config.json file.');
    return false;
  }

}

function sendFileListRequest(req, res) {
  if (!req.query) return res.send('Requires query parameter ?directory=[urlencoded dir]');
  if (!req.query.directory) {
    return res.send('Requires query parameter ?directory=[urlencoded dir]');
  } else {
    return res.json({
      path: getFilenamesFromDir(req.query.directory),
    });
  }
}

function getFilenamesFromDir(dirName) {
  console.log('dirName', dirName, '\n');
  var files = [];

  file.walkSync(dirName, (start, dirs, names) => {
    names.map(function (fileName) {
      files.push(path.join(start, fileName));
    });
  });

  return files;
}

function processDirRequest(req, res) {
  console.log('Process request to process directory');

  if (!req.query) return res.send('Requires query parameter ?directory=[urlencoded dir]');
  if (!req.query.directory) {
    return res.send('Requires query parameter ?directory=[urlencoded dir]');
  } else {
    return res.json({
      result: processFileDir(req.query.directory, path.resolve(config.thumbnailDir), config),
    });
  }
}

function processFileDir(pictureDir, config) {
  return new Promise((resolve, reject) => {
    var thumbs = [];

    var fileListStream = streamify(getFilenamesFromDir(path.resolve(pictureDir)).push(os.EOL));

    fileListStream.pipe(file => {
      console.log('Processing file', file);
      highland(processFile(file, config))
          .each(result => {
            console.log('Highland-wrapped processFile result:', result);
            thumbs.push(result);
          });
    })
        .done(() => {
          console.log('Being done here');
          resolve(thumbs);
        });
  });
}

function processFile(filePath, config) {
  return isPicture(filePath)
      .then(filePath => {
        return createMetadata(filePath, config);
      })
      .then(metadata => {
        console.log('Processing', metadata.pictures[0].pictureFileName, 'to', metadata.pictures[0].thumbnailFileName);

        return fs.statAsync(metadata.pictures[0].thumbnailFileName)
            .then(() => {
              console.log(
                  'Thumbnail for',
                  metadata.pictures[0].pictureFileName,
                  'already exists, skipping thumbnail creation'
              );
              return new Promise.resolve(metadata);
            })
            .catch(err => {
              if (err.code = 'ENOENT') {
                console.log('File does not exist yet');
              } else {
                return new Promise.reject(err);
              }

              return createThumbnail(metadata);
            });
      })
      .then(function (metadata) {
        return createOrUpdateDocument(config.elasticsearch.indexName, config.elasticsearch.docType, metadata.id, metadata);
      })
      .catch(err => {
        return new Promise.reject(err);
      });
}

function isPicture(picturePath) {
  return new Promise(function (resolve, reject) {
    gm(picturePath).size(err => {
      if (err) {
        reject(err);
      } else {
        resolve(picturePath);
      }
    });
  });
}

function createMetadata(filePath, config) {
  return fs.statAsync(filePath)
      .then(stats => {
        return createHash(filePath)
            .then(hash => {
              var metadata = {
                id: hash,
                pictures: [
                  {
                    pictureFileName: filePath,
                    thumbnailFileName: path.join(path.resolve(config.thumbnailDir), hash + '.jpg'),
                    href: 'file://' + filePath,
                    folders: path.normalize(filePath).split(path.sep).slice(0, -1),
                    thumbCreateDate: stats.ctime,
                  },
                ],
              };
              return new Promise.resolve(metadata);
            });
      });
}

function createHash(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(
            crypto.createHash('md5')
                .update(data)
                .digest('hex')
        );
      }
    });
  });
}

function createThumbnail(metadata) {
  return new Promise((resolve, reject) => {
    console.log('Making thumbnail', metadata.pictures[0].thumbnailFileName);
    return resizeImage(metadata.pictures[0].pictureFileName)
        .then(function (thumbnail) {
          return writeFile(thumbnail, metadata.pictures[0].thumbnailFileName);
        })
        .then(() => {
          resolve(metadata);
        })
        .catch(function (err) {
          console.error('processFile encountered error', err.stack);
          reject(err);
        });
  });
}

function resizeImage(pictureFileName) {
  return new Promise((resolve, reject) => {
    resolve(gm(pictureFileName).resize(config.width, config.height));
  });
}

function writeFile(thumbnail, thumbnailPath) {
  return new Promise((resolve, reject) => {
    thumbnail.write(thumbnailPath, function checkCorrectWrite(err) {
      if (err) {
        console.error('Error on writing thumbnail to ', err);
        reject(err);
      } else {
        console.log('Wrote ' + thumbnailPath);
        resolve();
      }
    });
  });
}

function createIndex(indexName, callback) {
  ESclient.indices.create({
    index: indexName,
  }, (error, response) => {
    return callback(error, response);
  });
}

function deleteIndex(indexName, callback) {
  ESclient.indices.delete({
    index: indexName,
  }, (error, response) => {
    return callback(error, response);
  });
}

function createThumbnailDir(thumbnailDir, callback) {
  mkdirp(thumbnailDir, error => {
    if (error) {
      console.error('Error making directory ' + thumbnailDir);
      throw(error);
    }

    return callback(error);
  });
}

function createOrUpdateDocument(index, type, docId, metadata) {
  return getDocumentById(index, type, docId)
      .then(response => {
        console.log('Document with id', docId, 'exists:', response);
        /*
         return ESclient.index({
         index: index,
         type: type,
         id: docId,
         body: {
         pictures: metadata.pictures.push(response._source.pictures[0])
         }
         });
         */
        return new Promise.resolve(response);
      })
      .catch(err => {
        console.log(err.stack);
        return ESclient.create({
          index: index,
          type: type,
          id: docId,
          body: metadata,
        });
      });
}

function getDocumentById(index, type, id) {
  return ESclient.get({
    index: index,
    type: type,
    id: id,
  });
}
