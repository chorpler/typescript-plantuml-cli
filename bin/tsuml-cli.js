#!/usr/bin/env node
"use strict";
var ts = require('typescript');
var tsuml = require('typescript-uml');
var program = require('caporal');
var glob = require('glob');
var fs = require('fs-extra');
var path = require('path');
var pumlenc = require('plantuml-encoder');
var request = require('request');
var puml = require('node-plantuml');
var outputFileNum = 1;
program
    .argument('<files>', 'input files path')
    .argument('<output>', 'output dir')
    .option('--combine [cflg]', 'make combined file')
    .option('--combineFile [cname]', 'make combined file name')
    .option('--makeimage', 'make image(.png files) use http://www.plantuml.com/plantuml/png/')
    .option('--makelocal', 'make image(.png files) use local plantuml and Graphbiz')
    .action(function (arg, option) {
    // validation
    if (!arg.files) {
        console.error('no file input');
        process.exit(1);
    }
    if (!arg.output) {
        console.error('no output dir');
        process.exit(1);
    }
    var fileList = glob.sync(arg.files);
    var fileListNum = fileList.length;
    var combinedPumlString = '';
    fileList.forEach(function (item) {
        var tmpPath = path.parse(item);
        var outDir = path.join(process.cwd(), arg.output, tmpPath.dir);
        var outFileBase = path.join(outDir, tmpPath.name);
        var plantumlData = getPlantUmlData(item);
        fs.outputFile(outFileBase + '.puml', addUmlTagString(plantumlData))
            .then(function () {
            if (option.makeimage) {
                combinedPumlString += plantumlData + "\n";
                makeImage(addUmlTagString(plantumlData), outFileBase + '.png', option.makelocal, outFileBase + '.puml');
            }
            if (outputFileNum >= fileListNum) {
                if (!option.combine) {
                    process.exit(0);
                    return;
                }
                if (!option.combineFile) {
                    console.error('no output combined file');
                    process.exit(1);
                }
                makeCombinedPumlFile(option.combineFile, combinedPumlString, arg.output, option.makeimage, option.makelocal);
            }
            else {
                outputFileNum++;
            }
        })
            .catch(function (err) {
            if (err) {
                return console.log(err);
            }
        });
    });
});
program.parse(process.argv);
function getPlantUmlData(filepath) {
    return tsuml.TypeScriptUml.generateClassDiagram(tsuml.TypeScriptUml.parseFile(filepath, ts.ScriptTarget.ES5), {
        formatter: 'plantuml',
        plantuml: {
            diagramTags: false,
        },
    });
}
function makeCombinedPumlFile(combinedFile, combinedPumlString, outputDir, isMakeImage, isLocal) {
    var outFileList = glob.sync(path.join(outputDir, '**/*.puml'));
    var pathListString = makeCombinedPathList(outFileList, combinedFile);
    fs.outputFile(combinedFile, addUmlTagString(pathListString))
        .then(function () {
        if (isMakeImage) {
            var imageFile = path.join(process.cwd(), path.dirname(combinedFile), path.basename(combinedFile, path.extname(combinedFile)) + '.png');
            makeImage(combinedPumlString, imageFile, isLocal, combinedFile);
        }
    })
        .catch(function (err) {
        if (err) {
            return console.log(err);
        }
    });
}
function makeCombinedPathList(pathList, combinedFile) {
    var includePathList = [];
    pathList.forEach(function (item) {
        includePathList.push("!include " + path.resolve(path.join(process.cwd(), combinedFile), path.join(process.cwd(), item)));
    });
    return includePathList.join('\n');
}
function makeImage(umlData, outFile, makeLocal, umlFilePath) {
    if (makeLocal) {
        var gen = puml.generate(umlFilePath);
        gen.out.pipe(fs.createWriteStream(umlFilePath.replace('.puml', '.png')));
    }
    else {
        request({
            method: 'GET',
            url: "http://www.plantuml.com/plantuml/png/" + pumlenc.encode(umlData),
            encoding: null
        }, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                fs.outputFile(outFile, body, 'binary')
                    .catch(function (err) {
                    if (err) {
                        return console.log(err);
                    }
                });
            }
        });
    }
    return;
}
function addUmlTagString(str) {
    return "@startuml\n" + str + "\n@enduml";
}
//# sourceMappingURL=tsuml-cli.js.map