'use strict';

var testconfig = require('./images/config.test.json');
var config_for_real = require('../config.json');

var Promise = require('bluebird')

var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var should = chai.should();
var assert = chai.assert;
var expect = chai.expect;

var gm = require('gm'),
    path = require('path'),
    elasticsearch = require('elasticsearch'),
    imageThumbnailer = require('../index.js'),
    fs = require('fs');

var dummyPicturePath = path.join(__dirname, testconfig.pictureDir, 'octobiwan.jpg'),
    dummyDuplicatePicturePath = path.join(__dirname, testconfig.pictureDir, 'octobiwan2.jpg'),
    dummyThumbnailPath = path.join(__dirname, testconfig.thumbnailDir, '065ea4640ad9cfb1c2ad8766bf5e9cfc.jpg'),
    noPicturePath = path.join(__dirname, 'README.md'),
    thumbnailPath = path.join(__dirname, testconfig.thumbnailDir);

var installGMMessage = 'Please install GraphicsMagick and make sure that the console you are using is aware of the binaries directory of GraphicsMagick';

describe('image-thumbnailer', function() {

    this.timeout(20000);

    it('should verify that graphics magick is properly installed', function(done) {
        assert.doesNotThrow( function() {
            gm(dummyPicturePath).size( function(err, size) {
                expect(err).to.be.not.null;
                console.log(size);
                done();
            });
        });
    });

    it('should verify the config picture directory as valid',
        () => assert.equal(imageThumbnailer.isValidPicturePath(config_for_real.pictureDir), true) );

    it('should be able to instantiate an elasticsearch client object',
        () => expect(imageThumbnailer.connectToES(testconfig)).to.be.not.null);

    it('should be able to create a document in the dummy index', () => {
        var testIndexDoc = {
            var1 : true,
            date : Date.now()
        };

        return imageThumbnailer.createOrUpdateDocument(
            testconfig.elasticsearch.indexName,
            testconfig.elasticsearch.docType,
            'my test doc',
            testIndexDoc
        )
            .then(function(metadata){
                console.log("Metadata:", metadata);
                return expect(metadata).to.be.not.null;
            })
            .catch(function(error){
                console.error('Unable to create document due to:', error);
                return expect(error).to.be.null;
            });
    });

    it('should be able to delete an index', function shouldCreateIndex(done){
        assert.doesNotThrow(function makeIndex(){
            imageThumbnailer.deleteIndex(testconfig.elasticsearch.indexName, function(error){
                if (error){
                    console.error('Unable to create index');
                    throw(error);
                }
                done();
            });
        });
    });

    it('should be able to create a directory for thumbnails to put into', function shouldCreateDir(done){
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

    it('should recognise a picture file as an image file', function() {
        return imageThumbnailer.isPicture(dummyPicturePath)
            .then(function(picturePath){
                console.log("Successfully validated", dummyPicturePath, "as image");
                return expect(picturePath).to.be.not.null;
            })
            .catch(function(err){
                return expect(err).to.be.null;
                console.log("Reject on picture file: ", err);
            });
    });

    it('should be able to recognise a text file as a non-image file', function() {
        return imageThumbnailer.isPicture(noPicturePath)
            .then(function(){
                console.log("Actually, this part shouldn't be reached");
            })
            .catch(function(err){
                console.log("Successfully induced reject on non-picture file: ", err);
                return expect(err).to.be.not.null;
            });
    });

    it('should resize an image', function shouldResizeImage(){
        return imageThumbnailer.resizeImage(dummyPicturePath).should.be.fulfilled;
    });

    it('should hash an image', function shouldHashImage(){
        return imageThumbnailer.createHash(dummyPicturePath)
            .then(function(hash){
                console.log("Hash:", hash);
                return expect(hash).to.equal('dcef3abedf0e0761203aaeb85886a6f3');
            })
    });

    it('should recognize two copies of the same file, despite having different filenames', function shouldDetectIdentical(){
        return imageThumbnailer.createHash(dummyPicturePath)
            .then(function(hash1){
                return imageThumbnailer.createHash(dummyDuplicatePicturePath)
                    .then(function(hash2){
                        console.log("Duplice file hashes: ", hash1, hash2);
                        return assert.equal(hash1, hash2);
                    })
            })
    });

    it('should get the metadata of a picture', function shouldGetMetadata(){
        var expectedResult = {
            "id": "dcef3abedf0e0761203aaeb85886a6f3"
        };

        return imageThumbnailer.getMetadata(dummyPicturePath, 'dcef3abedf0e0761203aaeb85886a6f3', dummyThumbnailPath)
            .then(function(result){
                console.log("Metadata:", result);
                expect(result.id).to.deep.equal(expectedResult.id);
            })
            .catch(function(err){
                return expect(err).to.be.null;
            });
    });

    it('should process a single image', function shouldProcessImage(){
        return expect(imageThumbnailer.processFile(dummyPicturePath, thumbnailPath, testconfig)).to.be.fulfilled;
/*
            .then(function handleResult(result){
                console.log("processFile result:", result);
                return expect(fs.existsSync(dummyThumbnailPath)).to.equal(true);
            })
            .catch(function(err){
                console.log("Thumbnail store error:", err.stack);
                return expect(err).to.be.null;
            });
*/
    });

    it('should return the contents of the test folder as a list of files', function shouldGetFiles(done){
        assert.doesNotThrow(function getFiles(){
            var fileList = imageThumbnailer.getFilenamesFromDir(path.join(__dirname, testconfig.pictureDir));
            assert.notEqual(fileList, null);

            console.log(fileList);
            done();
        });
    });

/*
    it('should process the files in the picture dir', function shouldProcess(){
        var result = imageThumbnailer.processFileDir(path.join(__dirname, testconfig.pictureDir));
        assert.notEqual(result, null);
        console.log(result);
    });
*/

});
