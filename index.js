/*
Thumbnail generation script for images or bzipped images
Usage: node index.js -infiles '/images/image*.tiff.bzip' -outdir /thumbs -width 250 -height 180
*/
'use strict';

var config = require('./config.json');

var fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    gm = require('gm'),
    bunzip = require('seek-bzip'),
    async = require('async'),
    elasticsearch = require('elasticsearch'),
    mkdirp = require('mkdirp'),
    file = require('file'),
    express = require('express');

var pictureFileName,
    outFileName,
    stats,
    thumbs = [],
    ESclient;

module.exports.connectToES = connectToES;
module.exports.isValidPicturePath = isValidPicturePath;
module.exports.createIndex = createIndex;
module.exports.deleteIndex = deleteIndex;
module.exports.createOrUpdateDocument = createOrUpdateDocument;
module.exports.createThumbnailDir = createThumbnailDir;
module.exports.resizeImage = resizeImage;
module.exports.writeThumbnail = writeThumbnail;
module.exports.getMetadata = getMetadata;
module.exports.createHash = createHash;
module.exports.getFilenamesFromDir = getFilenamesFromDir;

(function main(){
    connectToES(function startServer(error){
        if (error) {
            console.error('The connection with the picture indexer could not be made, exiting');
            throw(error);
        } else {
            if (isValidPicturePath(config.pictureDir)) {
                startService();
            } else {
                console.error(config.pictureDir, ' does not look like a valid directory to prcess. Please specify a different directory of images to process.')
            }
        }

    });
})();

function startService(){
    var app = express();
    app.use(express.static('assets'));

    app.get('/test', function sendTest(req, res) {
        res.send('Up and running');
    });

    app.get('/picturedir', function sendPictureDir(req,res){
        res.json({path: path.resolve(config.pictureDir)});
    });

    app.get('/filelist', sendFileList);

    var server = app.listen(3000, function () {
        var host = server.address().address;
        var port = server.address().port;

        console.log('Web server and API listening at http://%s:%s', host, port);
    });
}

function connectToES(callback) {
    ESclient = new elasticsearch.Client({
        host: config.elasticsearch.connectParams,
        log: 'trace'
    });

    ESclient.ping({
        // ping usually has a 3000ms timeout
        requestTimeout: 3000,

        // undocumented params are appended to the query string
        hello: "elasticsearch!"
    }, function (error) {
        if (error) {
            console.error('elasticsearch is down!');
            return callback(error);
        } else {
            console.log('All is well');
            return callback();
        }
    });
}


function isValidPicturePath(pictureDir) {
    try {
        var stats = fs.lstatSync(path.resolve(pictureDir));
        return stats.isDirectory() ? true : false;
    } catch (err) {
        console.error('Something went wrong checking for configurated directory', pictureDir, ', please specify a valid directory in the config.json file.');
        return false
    }

}

function sendFileList(req, res){
    if (!req.query) return res.send("Requires query parameter ?directory=[urlencoded dir]");
    if (!req.query.directory) {
        return res.send("Requires query parameter ?directory=[urlencoded dir]");
    } else {
        var JSONobject = JSON.parse('{ "path": ' + req.query.directory + '}');
        return res.json({path: getFilenamesFromDir(JSONobject.path)});
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


function processFileDir(path){
    var fileList = getFilenamesFromDir(path);

    async.eachLimit({
        array: fileList,
        limit: 20,
        iterator: processFile,
        callback: asyncComplete

    });

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

function resizeImage(pictureFileName){
    return gm(pictureFileName).resize(config.width, config.height);
}

function writeThumbnail(path, image){
    fs.writeFileSync(path, image);
}

function getMetadata(filePath, callback) {
    try {
        stats = fs.lstatSync(filePath);
    } catch (err) {
        console.error('Unable to read from file path', filePath);
        return callback();
    }

    fs.readFile(filePath, function createMetadata(err, data){
        if (err) {
            console.error('There was an error reading from file', filePath, err);
            return callback();
        }

        outFileName = createHash(data) + '.jpg';

        var dirNames = path.normalize(filePath).split(path.sep);

        var metadata = {
            thumbnailFileName: outFileName,
            href: pictureFileName,
            folders: dirNames,
            thumbcreatedate: stats.ctime
        };

        return callback(metadata);
    });
}

function createHash(data) {
    return crypto.createHash('md5')
            .update(data)
            .digest('hex');
}

function createOrUpdateDocument(index, type, docId, callback){
    ESclient.exists({
        index: index,
        type: type,
        id: docId
    }, function docExistsCallback(error, exists) {
        if (exists === true) {
            ESclient.update({
                index: index,
                type: type,
                id: docId,
                body: {
                    // put the partial document under the `doc` key
                    doc: {
                        title: 'Updated'
                    }
                }
            }, function (error, response) {
                return callback(error, response);
            });
        } else {
            ESclient.create({
                index: index,
                type: type,
                id: docId,
                body: {
                    title: 'Test 1',
                    tags: ['y', 'z'],
                    published: true,
                    published_at: '2013-01-01',
                    counter: 1
                }
            }, function (error, response) {
                return callback(error, response);
            });
        }
    });
}

function processFile(filePath, asyncCallbackDone) {
    try {
        // Check if thumb is already present
        stats = fs.lstatSync(config.thumbnailDir + outFileName);

        if (stats.isFile()) {
            console.log('Thumbnail for ' + pictureFileName + ' already exists, skipping thumbnail creation');
        }
    } catch (e) {
        console.log('File does not exist yet, making thumbnail');

        var thumbnail = resizeImage(file);
        thumbnail.write(path.join(__dirname, config.thumbnailDir, outFileName), checkCorrectWrite);
    }

    var hash = getMetadata(filePath);
    createOrUpdateDocument(config.elasticsearch.indexName, config.elasticsearch.docType, hash, function done(){
        asyncCallbackDone();
    })
}

function checkCorrectWrite(err) {
    if (err) {
        console.log(err);
        callback(err);
    } else {
        console.log('Wrote ' + config.thumbnailDir + outFileName);
    }
}


function asyncComplete(err) {
    'use strict';
    console.log(filelist.length + ' files for processing');
    fs.appendFileSync(argv.outdir + '/thumbs.js', "var thumbs = " + JSON.stringify(thumbs) + "\n");
    fs.appendFileSync(argv.outdir + '/index.html', "</html>\n </body>\n");

    if (err) {
        fs.appendFile(argv.outdir + '/errors.txt', new Date().toLocaleString() + " " + pictureFileName + ": " + err + "\n");
    }
}
function extractBZIP(file){
    if (file.substr(file.length - 4, file.length) === ".bzip") {
        var compressedData = fs.readFileSync(file);
        var data = bunzip.decode(compressedData);
        var tempFileName = '/tmp/' + file.substr(0, file.length - 4); //get rid of bzip extension
        fs.writeFileSync(pictureFileName, data);
        pictureFileName = tempFileName;
    } else {
        pictureFileName = String(file);
    }
}
