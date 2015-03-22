/*
Thumbnail generation script for images or bzipped images
Usage: node index.js -infiles '/images/image*.tiff.bzip' -outdir /thumbs -width 250 -height 180
*/

var argv = require('optimist')
    .usage('Create image thumbnails from .\nUsage: $0')
    .demand(['infiles', 'outdir', 'width', 'height'])
    .argv,
    fs = require('fs'),
    path = require('path'),
    gm = require('gm'),
    glob = require('glob'),
    bunzip = require('seek-bzip'),
    async = require('async');

var options,
    tempFileName,
    pictureFileName,
    outFileName,
    compressedData,
    stats,
    data;

options = {
    nocase: true
};

var filelist = glob.sync(argv.infiles, options);
console.log(filelist.length + ' files for processing');

async.eachLimit(
    filelist,
    20, //limit asynchronous processing to 20 files at the same time
    function (file, callback) {
        'use strict';
        console.log(file);

        /*
        if (file.substr(file.length - 4, file.length) === ".bzip") {
            compressedData = fs.readFileSync(file);
            data = bunzip.decode(compressedData);
            tempFileName = '/tmp/' + file.substr(0, file.length - 4); //get rid of bzip extension
            fs.writeFileSync(pictureFileName, data);
            pictureFileName = tempFileName;

        } else {

            pictureFileName = String(file);
        }
        */

        pictureFileName = String(file);
        outFileName = pictureFileName.split('/');
        outFileName = outFileName[outFileName.length - 1];

        try {
            // Query the entry
            stats = fs.lstatSync(argv.outdir + '/' + outFileName);

            if (stats.isFile()) {
                console.log(argv.outdir + '/' + outFileName + ' already exists, skipping, logging to errors.txt');
                callback();
            }
        } catch (e) {
            console.log('File does not exist');

            gm(pictureFileName).resize(argv.width, argv.height).write(argv.outdir + '/' + outFileName, function (err) {
                if (err) {
                    console.log(err);
                    callback(err);
                } else {
                    console.log('Wrote ' + argv.outdir + outFileName);
                    callback();
                }
            });
        }
    },
    function (err) {
        'use strict';
        if (err) {
            fs.appendFile('errors.txt', new Date().toLocaleString() + " " + pictureFileName + ": " + err + "\n");
        }
    }
);
