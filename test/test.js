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

var testhash = "dcef3abedf0e0761203aaeb85886a6f3",
    dummyPicturePath = path.resolve(
        path.join(testconfig.pictureDir, 'octobiwan.jpg')
    ),
    dummyDuplicatePicturePath = path.resolve(
        path.join(testconfig.pictureDir, 'octobiwan2.jpg')
    ),
    dummyThumbnailPath = path.resolve(
        path.join(testconfig.thumbnailDir, testhash + '.jpg')
    ),
    noPicturePath = path.join(__dirname, 'README.md'),
    thumbnailPath = path.resolve(testconfig.thumbnailDir);

var installGMMessage = 'Please install GraphicsMagick and make sure that the console you are using is aware of the binaries directory of GraphicsMagick';

describe('image-thumbnailer', function() {

    this.timeout(20000);

    it('should verify that graphics magick is properly installed', function(done) {
        assert.doesNotThrow( function() {
            gm(dummyPicturePath).size( function(err, size) {
                if (err) console.log(installGMMessage);
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

    it('should get the metadata of a picture', () => {
        var expectedResult = {
            "id": "dcef3abedf0e0761203aaeb85886a6f3"
        };

        return imageThumbnailer.createMetadata(dummyPicturePath, testconfig)
            .then(function(result){
                console.log("Metadata:", result);
                expect(result.id).to.deep.equal(expectedResult.id);
            })
    });

    it('should write the thumbnail for a single image', () => {
        if (fs.existsSync(dummyThumbnailPath)) fs.unlinkSync(dummyThumbnailPath);

        return imageThumbnailer.createMetadata(dummyPicturePath, testconfig)
            .then(metadata => imageThumbnailer.createThumbnail(metadata))
            .then(metadata => {
                console.log("Metadata:", metadata);
                return expect(fs.existsSync(dummyThumbnailPath)).to.equal(true);
            })
    });

    it('should process a single image', function shouldProcessImage(){
        if (fs.existsSync(dummyThumbnailPath)) fs.unlinkSync(dummyThumbnailPath);

        return imageThumbnailer.processFile(dummyPicturePath, testconfig)
            .then(function handleResult(result){
                console.log("processFile result:", result);
                console.log(dummyThumbnailPath, "exist: ", fs.existsSync(path.resolve(dummyThumbnailPath)));
                return expect(fs.existsSync(dummyThumbnailPath)).to.equal(true);
            })
            .catch(function(err){
                console.log("Thumbnail store error:", err.stack);
                throw(err);
            });
    });

    it('should get the metadata document from the index', () => {
        return imageThumbnailer.createMetadata(dummyPicturePath, testconfig)
        .then(metadata => imageThumbnailer.getDocumentById(
            testconfig.elasticsearch.indexName,
            testconfig.elasticsearch.docType,
            metadata.id
        ))
        .then(response => {
            console.log(response);
            return expect(response._source.id).to.equal(testhash);
        })

    });

    it('should reject a single non-picture file', () => {
        return imageThumbnailer.processFile(noPicturePath, testconfig)
            .catch(err => {
                console.log("Expected processFile error:", err);
                return expect(err).to.be.not.null;
            });
    });

    it('should process a single image for which a thumbnail already exists', () => {
        return imageThumbnailer.processFile(dummyPicturePath, testconfig)
            .then(function handleResult(result){
                console.log("processFile result:", result);
                console.log(dummyThumbnailPath, "exist: ", fs.existsSync(path.resolve(dummyThumbnailPath)));
                return expect(fs.existsSync(dummyThumbnailPath)).to.equal(true);
            })
            .catch(function(err){
                console.log("Thumbnail store error:", err.stack);
                throw(err);
            });
    });

    it('should process another single image for which a thumbnail already exists', () => {
        return imageThumbnailer.processFile(dummyPicturePath, testconfig)
            .then(function handleResult(result){
                console.log("processFile result:", result);
                console.log(dummyThumbnailPath, "exist: ", fs.existsSync(path.resolve(dummyThumbnailPath)));
                return expect(fs.existsSync(dummyThumbnailPath)).to.equal(true);
            })
            .catch(function(err){
                console.log("Thumbnail store error:", err.stack);
                throw(err);
            });
    });

    it('should process another single duplicate image for which a thumbnail already exists', () => {
        return imageThumbnailer.processFile(dummyDuplicatePicturePath, testconfig)
            .then(function handleResult(result){
                console.log("processFile result:", result);
                console.log(dummyThumbnailPath, "exist: ", fs.existsSync(path.resolve(dummyThumbnailPath)));
                return expect(fs.existsSync(dummyThumbnailPath)).to.equal(true);
            })
            .catch(function(err){
                console.log("Thumbnail store error:", err.stack);
                throw(err);
            });
    });

    it('should return the contents of the test folder as a list of files', () => {
        var fileList = imageThumbnailer.getFilenamesFromDir(path.resolve(testconfig.pictureDir));
        console.log(fileList);
        return assert.deepEqual(fileList, [ 'C:\\Users\\Rein\\Documents\\Git\\image-thumbnailer\\test\\images\\config.test.json',
            'C:\\Users\\Rein\\Documents\\Git\\image-thumbnailer\\test\\images\\octobiwan.jpg',
            'C:\\Users\\Rein\\Documents\\Git\\image-thumbnailer\\test\\images\\octobiwan2.jpg' ]);
    });

    it('should process the test files in the picture dir', () => {
        return imageThumbnailer.processFileDir(testconfig.pictureDir, testconfig)
            .then(result => {
                console.log("Result", result, "\n");
                return expect(result).to.equal(true);
            })
            .catch(err => {
                throw err;
            });
    });

});
