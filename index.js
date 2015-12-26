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
    crypto = require('crypto'),
    gm = require('gm'),
    glob = require('glob'),
    bunzip = require('seek-bzip'),
    async = require('async');

var options,
    tempFileName,
    pictureFileName,
    outFileName,
    dirName,
    compressedData,
    stats,
    data,
    thumbs = [];

options = {
    nocase: true
};

var filelist = glob.sync(argv.infiles, options);
/*
try { //remove old index.html if present
    stats = fs.lstatSync(argv.outdir + '/index.html'); //throws error if not found
    fs.unlinkSync(argv.outdir + '/index.html');
} catch (err) {
    fs.appendFileSync(argv.outdir + '/errors.txt', new Date().toLocaleString() + " " + err + "\n");
}


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
*/

try { //make img directory if not present
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
        outFileName = crypto.createHash('md5').update(file).digest('hex') + '.jpg';

        fs.appendFileSync(
            argv.outdir + '/index.html',
            "<div class='tile'>\n" +
                "<a href='file://" + pictureFileName + "'>" +
                "<img class='thumbnail' src='img/" + outFileName + "'></img>\n" +
                "</a>\n" +
                "</div>\n"
        );

        dirName = pictureFileName.split('/');
        dirName = dirName[dirName.length - 2];

        try {
            // Check if thumb is already present
            stats = fs.lstatSync(argv.outdir + '/img/' + outFileName);

            if (stats.isFile()) {
                thumbs.push({
                    'src': 'img/' + outFileName,
                    'href': pictureFileName,
                    'folder': dirName,
                    'thumbcreatedate': stats.ctime
                });
                console.log('Thumbnail for ' + pictureFileName + ' already exists, skipping');
                callback();
            }
        } catch (e) {
            console.log('File does not exist yet, making thumbnail');

            gm(pictureFileName).resize(argv.width, argv.height).write(argv.outdir + '/img/' + outFileName, function (err) {
                if (err) {
                    console.log(err);
                    callback(err);
                } else {
                    console.log('Wrote ' + argv.outdir + '/img/' + outFileName);
                        thumbs.push({
                            'src': 'img/' + outFileName,
                            'href': pictureFileName,
                            'folder': dirName,
                            'thumbcreatedate': new Date().toLocaleString()
                        });

                    callback();
                }
            });
        }
    },
    function (err) {
        'use strict';
        console.log(filelist.length + ' files for processing');
        fs.appendFileSync(argv.outdir + '/thumbs.js', "var thumbs = " + JSON.stringify(thumbs) + "\n");
        fs.appendFileSync(argv.outdir + '/index.html', "</html>\n </body>\n");

        if (err) {
            fs.appendFile(argv.outdir + '/errors.txt', new Date().toLocaleString() + " " + pictureFileName + ": " + err + "\n");
        }
    }
);
