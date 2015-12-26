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
    pictureFileName,
    compressedData,
    data;

options = {
	nocase: true
};

var filelist = glob.sync(argv.infiles, options);
console.log(filelist.length);

async.eachSeries(
    filelist, 
    function (file, callback) {
        'use strict';
        console.log(file);
        
        /*

        if (file.name.substr(file.name.length - 4, file.name.length) === ".bzip") {
            compressedData = fs.readFileSync(file.path);
            data = Bunzip.decode(compressedData);
            pictureFileName = file.name.substr(0, file.name.length - 4);
            fs.writeFileSync(pictureFileName, data);
        } else {
            pictureFileName = file.name;
        }
        */

        var pictureFileName = String(file);
        var outfilename = pictureFileName.split('/');
        outfilename = outfilename[outfilename.length - 1];
        fs.exists(argv.outdir + '/' + outfilename, function (exists) {
            if (exists) {
                console.log(argv.outdir + '/' + outfilename + ' already exists, skipping, logging to errors.txt')
                fs.appendFileSync('errors.txt', new Date().toLocaleString() + " " + argv.outdir + '/' + outfilename + " already exists, skipping\n");
            } else { 
                //use graphicsMagick to resize and save source file to target outfilename
                gm(pictureFileName).resize(argv.width, argv.height).write(argv.outdir + '/' + outfilename, function (err) {
                    if (err) {
                        console.log(err);
                        callback(err); 
                    } else {
                        console.log('Wrote ' + argv.outdir + outfilename);
                        callback();
                    }
                });
            }
        });
    }, 
    function (err) {
        if (err) {
            fs.appendFileSync('errors.txt', new Date().toLocaleString() + " " + pictureFileName + ": " + error + "\n");
        }
    }
);
