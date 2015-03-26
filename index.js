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

fs.appendFileSync(argv.outdir + '/index.html', "<html>\n <head>\n");
fs.appendFileSync(argv.outdir + '/index.html',
    "<style>\n" +
    ".tile {\n" +
    "   float: left;\n" +
    "   background-color: #CCC;\n" +
    "   width: 193.333px;\n" +
    "   height: 172px;\n" +
    "   line-height: 170px;\n" +
    "}\n" +
    ".thumbnail {\n" +
    "    max-width: 193.33333px;\n" +
    "    max-height: 172px;\n" +
    "    height: auto;\n" +
    "    vertical-align: middle;\n" +
    "}\n" +
    "</style>\n" +
    "</head>\n" +
    "<body>\n");

try { //make img directory if not present
    // Query the entry
    stats = fs.lstatSync(argv.outdir + '/img');

    if (stats.isDirectory()) {
        console.log('img directory already present');
    } else {
        console.log('Making img directory');
        fs.createDirSync(argv.outdir + '/img');
    }
} catch (e) {
    console.log('Making img directory');
    fs.createDirSync(argv.outdir + '/img');
}

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

        fs.appendFileSync(
            argv.outdir + '/index.html',
            "<div class='tile'>\n" +
                "<a href='file://" + pictureFileName + "'>" +
                "<img class='thumbnail' src='img/" + outFileName + "'></img>\n" +
                "</a>\n" +
                "</div>\n"
        );

        try {
            // Query the entry
            stats = fs.lstatSync(argv.outdir + '/img/' + outFileName);

            if (stats.isFile()) {
                console.log(argv.outdir + '/img/' + outFileName + ' already exists, skipping');
                callback();
            }
        } catch (e) {
            console.log('File does not exist yet, making thumbnail');

            gm(pictureFileName).resize(argv.width, argv.height).write(argv.outdir + '/img/' + outFileName, function (err) {
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
            fs.appendFile(argv.outdir + '/errors.txt', new Date().toLocaleString() + " " + pictureFileName + ": " + err + "\n");
        }
    }
);

fs.appendFile('index.html', "</html>\n </body>\n");
