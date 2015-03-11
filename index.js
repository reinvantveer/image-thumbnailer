/*
Thumbnail generation script for images or bzipped images
Usage: node index.js -infiles '/images/image*.tiff.bzip' -outdir /thumbs -width 250 -height 180
*/

var argv = require('optimist')
    .usage('Create image thumbnails from .\nUsage: $0')
    .demand(['indir', 'outdir', 'compression', 'width', 'height'])
    .describe('f', 'Load a file')
    .argv,
    fs = require('fs'),
    path = require('path'),
    imageMagick = require('imageMagick'),
    glob = require('glob'),
    bunzip = require('seek-bzip');

var pictureFileName,
    compressedData,
    data;

glob(argv.infiles, function (er, infiles) {
    'use strict';
    infiles.forEach(function (file) {

        if (file.name.substr(file.name.length - 4, file.name.length) === ".bzip") {
            compressedData = fs.readFileSync(file.path);
            data = Bunzip.decode(compressedData);
            pictureFileName = file.name.substr(0, file.name.length - 4);
            fs.writeFileSync(pictureFileName, data);
        } else {
            pictureFileName = file.name;
        }

        imageMagick(pictureFileName)
            .resize(argv.width, argv.height, '^')
            .gravity('center')
            .extent(argv.width, argv.height)
            .write(argv.outdir, function (error) {
                if (error) {
                    console.log(error);
                }
            });
    });
});
