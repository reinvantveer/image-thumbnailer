'use strict';

var config = require('./config.test.json');

var assert = require('assert'),
    gm = require('gm'),
    path = require('path'),
    elasticsearch = require('elasticsearch'),
    imageThumbnailer = require('../index.js'),
    fs = require('fs');

var dummyPicturePath = path.join(__dirname, 'octobiwan.jpg'),
    dummyDuplicatePicturePath = path.join(__dirname, 'octobiwan2.jpg'),
    dummyThumbnailPath = path.join(__dirname, config.thumbnailDir, 'octobiwan.thumb.jpg'),
    noPicturePath = path.join(__dirname, 'README.md'),
    thumbnailPath = path.join(__dirname, config.thumbnailDir);

var installGMMessage = 'Please install GraphicsMagick and make sure that the console you are using is aware of the binaries directory of GraphicsMagick';

describe('image-thumbnailer', function() {

    this.timeout(20000);

    it('should verify that graphics magick is properly installed', function(done) {
        assert.doesNotThrow( function() {
            getDummyPictureSize(dummyPicturePath, function(err, size) {
                console.log(size);
                assert.notEqual(size, null, installGMMessage);
                done();
            });
        });
    });

    it('should be able to recognise a text file as a non-image file', function(done) {
        getDummyPictureSize(noPicturePath, function(err) {
            assert.throws( function(){
                if (err) throw(err);
            });
            done();
        });
    });

    it('should be able to connect to elasticsearch', function shouldConnectToES(done){
        assert.doesNotThrow(function connect(){
            imageThumbnailer.connectToES(function(error){
                if (error){
                    console.error('Connection to elasticsearch failed. Is it installed and running?')
                    throw(error);
                }
                done();
            });
        });
    });

    it('should be able to create an index', function shouldCreateIndex(done){
        assert.doesNotThrow(function makeIndex(){
            imageThumbnailer.createIndex(config.indexName, function(error){
                if (error){
                    console.error('Unable to create index');
                    throw(error);
                }
                done();
            });
        });
    });

    it('should be able to create a document in the dummy index', function shouldCreateDoc(done){
        assert.doesNotThrow(function createDoc(){
            imageThumbnailer.createOrUpdateDocument(config.indexName, config.docType, 'my test doc', function(error){
                if (error){
                    console.error('Unable to create document');
                    throw(error);
                }
                done();
            });
        });
    });

    it('should be able to delete an index', function shouldCreateIndex(done){
        assert.doesNotThrow(function makeIndex(){
            imageThumbnailer.deleteIndex(config.indexName, function(error){
                if (error){
                    console.error('Unable to create index');
                    throw(error);
                }
                done();
            });
        });
    });

    it('should be able to create a directory for thumbnails to put into', function shouldCreateDir(){
        assert.doesNotThrow(function createDir(){
            imageThumbnailer.createThumbnailDir(thumbnailPath, function(error){
                if (error) {
                    console.error(error);
                    throw(error);
                }
                done();
            });
        })
    });

    it('should resize and store an image', function shouldResizeImage(done){
        assert.doesNotThrow(function resizeImage(){
            var resizedImage = imageThumbnailer.resizeImage(dummyPicturePath);
            assert.notEqual(resizedImage, null);
            assert.notEqual(resizedImage, undefined);
            resizedImage.write(dummyThumbnailPath, function(error){
                assert.equal(error, undefined);
                assert.equal(fs.existsSync(dummyThumbnailPath), true);
            });
            done();
        })
    });

    it('should get the metadata of a picture', function shouldGetMetadata(done){
        assert.doesNotThrow(function getMetadata(){
            imageThumbnailer.getMetadata(dummyPicturePath, function inspectMetadata(metadata){
                assert.notEqual(metadata, null);
                console.log(JSON.stringify(metadata));
                done();
            });
        });
    });

    it('should recognize two copies of the same file, despite having different filenames', function shouldDetectIdentical(done){
        assert.doesNotThrow(function getHashes(){
            var hash1 = imageThumbnailer.createHash(fs.readFileSync(dummyPicturePath));
            var hash2 = imageThumbnailer.createHash(fs.readFileSync(dummyDuplicatePicturePath));
            assert.notEqual(hash1, null);
            assert.equal(hash1, hash2);
            done();
        });
    });

    it('should return the contents of the test folder as a list of files', function shouldGetFiles(done){
        assert.doesNotThrow(function getFiles(){
            var fileList = imageThumbnailer.getFilenamesFromDir(__dirname);
            assert.notEqual(fileList, null);
            console.log(fileList);
            done();
        });
    });


});

function getDummyPictureSize(picturePath, callback) {
    gm(picturePath).size( function(err, size) {
        return callback(err, size);
    });
}
