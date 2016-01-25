/*
Thumbnail generation script for images or bzipped images
*/
'use strict';

var config = require('./config.json');

var
    fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    gm = require('gm'),
    highland = require('highland'),
    elasticsearch = require('elasticsearch'),
    mkdirp = require('mkdirp'),
    file = require('file'),
    express = require('express');

var Promise = require('bluebird');
Promise.promisifyAll(fs);

var pictureFileName,
    outFileName,
    ESclient;

module.exports = {
    connectToES: connectToES,
    isValidPicturePath : isValidPicturePath,
    createIndex : createIndex,
    deleteIndex : deleteIndex,
    createOrUpdateDocument : createOrUpdateDocument,
    createThumbnailDir : createThumbnailDir,
    resizeImage : resizeImage,
    getMetadata : getMetadata,
    createHash : createHash,
    getFilenamesFromDir : getFilenamesFromDir,
    processFileDir : processFileDir,
    processFile : processFile,
    isPicture : isPicture,
    writeFile : writeFile
};

(function main(){
    ESclient = connectToES(config);

    if (isValidPicturePath(config.pictureDir)) {
        startService();
    } else {
        console.error(config.pictureDir, ' does not look like a valid directory to process. Please specify a different directory of images to process.')
    }

    function startService(){
        var app = express();
        app.use(express.static('assets'));

        app.get('/test', (req, res) => res.send('Up and running'));

        app.get('/picturedir', function sendPictureDirRequest(req, res){
            res.json({path: path.resolve(config.pictureDir)});
        });

        app.get('/filelist', sendFileListRequest);

        app.get('/process', processDirRequest);

        var server = app.listen(3000, function () {
            var host = server.address().address;
            var port = server.address().port;

            console.log('Web server and API listening at http://%s:%s', host, port);
        });
    }

})();

function connectToES(config) {
        ESclient = new elasticsearch.Client({
            host: config.elasticsearch.connectParams,
            log: 'trace'
        });

        return ESclient;
}

function isValidPicturePath(pictureDir) {
    try {
        var stats = fs.lstatSync(path.resolve(pictureDir));
        console.log("Is existing directory:", stats.isDirectory());
        return stats.isDirectory() ? true : false;
    } catch (err) {
        console.error('Something went wrong checking for configurated directory', pictureDir, ', please specify a valid directory in the config.json file.');
        return false
    }

}

function sendFileListRequest(req, res){
    if (!req.query) return res.send("Requires query parameter ?directory=[urlencoded dir]");
    if (!req.query.directory) {
        return res.send("Requires query parameter ?directory=[urlencoded dir]");
    } else {
        return res.json({path: getFilenamesFromDir(req.query.directory)});
    }
}

function getFilenamesFromDir(dirName){
    console.log("dirName", dirName);
    var files = [];

    file.walkSync(dirName, function(start, dirs, names) {
        names.map(function (fileName) {
            files.push(path.join(start, fileName));
        });
    });

    return files;
}

function processDirRequest(req, res) {
    console.log('Process request to process directory');

    if (!req.query) return res.send("Requires query parameter ?directory=[urlencoded dir]");
    if (!req.query.directory) {
        return res.send("Requires query parameter ?directory=[urlencoded dir]");
    } else {
        return res.json({result: processFileDir(req.query.directory, path.resolve(config.thumbnailDir))});
    }
}

function processFileDir(pictureDir, thumbnailDir){
    var fileList = getFilenamesFromDir(pictureDir);
    var thumbs = [];

    highland(fileList)
        .each(function(file){
            console.log(file);
            processFile(file, thumbnailDir, function(thumbnailPath){
                thumbs.push(thumbnailPath);
            });
        })
        .parallel(10)
        .done(function(){
            return thumbs
        });
}

function processFile(filePath, thumbnailDir, config) {
    return isPicture(filePath)
        .then(function(filePath){
            return createHash(filePath)
        })
        .then(function (hash) {
            var thumbnailPath = path.join(thumbnailDir, hash + ".jpg");
            console.log("Processing ", filePath, "to", thumbnailPath);
            return fs.statAsync(thumbnailPath)
                .then(function skipThumbnailCreation(){
                    console.log('Thumbnail for ' + pictureFileName + ' already exists, skipping thumbnail creation');
                    return getMetadata(filePath, hash, thumbnailPath);
                })
                .catch(function createThumbnail(err){
                    console.log('File does not exist yet, making thumbnail', thumbnailPath);
                    return resizeImage(filePath)
                        .then(function (thumbnail) {
                            return writeFile(thumbnail, thumbnailPath);
                        })
                        .then(function(filePath, hash, thumbnailPath){
                            return getMetadata(filePath, hash, thumbnailPath);
                        })
                        .catch(function(err){
                            console.error("processFile encountered error", err.stack);
                            throw (err);
                        });
                })
        })
        .then(function (metadata) {
            return createOrUpdateDocument(config.elasticsearch.indexName, config.elasticsearch.docType, metadata.id, metadata)
        })
        .catch(function (err) {
            console.error("processFile encountered error", err.stack);
            throw (err);
        })
}

function createHash(filePath) {
    return new Promise( function(resolve, reject){
        fs.readFile(filePath, function(err, data){
            if (err) {
                reject(err)
            } else {
                resolve(
                    crypto.createHash('md5')
                        .update(data)
                        .digest('hex')
                )
            }
        });
    });
}

function isPicture(picturePath) {
    return new Promise(function (resolve, reject) {
        gm(picturePath).size( function resolveOrReject(err) {
            if (err) {
                reject(err)
            } else {
                resolve(picturePath);
            }
        });
    })
}

function resizeImage(pictureFileName, metadata){
    return new Promise( function(resolve, reject){
        resolve(gm(pictureFileName).resize(config.width, config.height), metadata);
    });
}

function getMetadata(filePath, hash, thumbnailPath) {
    return fs.statAsync(filePath)
        .then(function(stats) {
            var metadata = {
                id: hash,
                thumbnailFileName: thumbnailPath,
                href: pictureFileName,
                folders: path.normalize(filePath).split(path.sep),
                thumbCreateDate: stats.ctime
            };
            return new Promise.resolve(metadata);
        });
}

function writeFile(thumbnail, thumbnailPath){
    return new Promise(function (resolve, reject){
            thumbnail.write(thumbnailPath, function checkCorrectWrite(err) {
                if (err) {
                    console.error("Error on writing thumbnail to ", err);
                    reject(err);
                } else {
                    console.log('Wrote ' + config.thumbnailDir + outFileName);
                    resolve();
                }
            });
    });
}

function createIndex(indexName, callback){
    ESclient.indices.create({
        index: indexName
    }, function (error, response){
        return callback(error, response);
    })
}

function deleteIndex(indexName, callback){
    ESclient.indices.delete({
        index: indexName
    }, function (error, response){
        return callback(error, response);
    })
}

function createThumbnailDir(thumbnailDir, callback){
    mkdirp(thumbnailDir, function(error){
        if (error) {
            console.error('Error making directory ' + thumbnailDir);
            throw(error);
        }
        callback(error)
    });
}

function createOrUpdateDocument(index, type, docId, metadata){
    return ESclient.exists({
        index: index,
        type: type,
        id: docId
    })
        .then( (exists) => {
            console.log("Document with id", docId, "exists:", exists);
            if (exists) {
                return ESclient.update({
                    index: index,
                    type: type,
                    id: docId,
                    body: metadata
                });
            } else {
                return ESclient.create({
                    index: index,
                    type: type,
                    id: docId,
                    body: metadata
                });
            }
        });
}
