#!/usr/bin/env node

const ts = require('typescript');
const tsuml = require('typescript-uml');
const program = require('caporal');
const glob = require('glob');
const fs = require('fs-extra');
const path = require('path');
const pumlenc = require('plantuml-encoder');
const request = require('request');
const puml = require('node-plantuml');

let outputFileNum:number = 1;

program
  .argument('<files>', 'input files path')
  .argument('<output>', 'output dir')
  .option('--combine [cflg]', 'make combined file')
  .option('--combineFile [cname]', 'make combined file name')
  .option('--makeimage', 'make image(.png files) use http://www.plantuml.com/plantuml/png/')
  .option('--makelocal', 'make image(.png files) use local plantuml and Graphbiz')
  .action((arg: any, option: any) => {
    // validation
    if(!arg.files) {
      console.error('no file input');
      process.exit(1);
    }
    if(!arg.output){
      console.error('no output dir');
      process.exit(1);
    }
    const fileList: string[] = glob.sync(arg.files);
    const fileListNum: number = fileList.length;
    let combinedPumlString: string = '';

    fileList.forEach((item: string) => {
      const tmpPath = path.parse(item);
      const outDir: string = path.join(process.cwd(), arg.output, tmpPath.dir);
      const outFileBase: string = path.join(outDir, tmpPath.name);
      const plantumlData: string = getPlantUmlData(item);

      fs.outputFile(outFileBase + '.puml', addUmlTagString(plantumlData))
        .then(() => {
          if(option.makeimage) {
            combinedPumlString += `${plantumlData}\n`;
            makeImage(addUmlTagString(plantumlData), outFileBase + '.png', option.makelocal, outFileBase + '.puml');
          }
          if(outputFileNum >= fileListNum) {
            if(!option.combine) {
              process.exit(0);
              return;
            }

            if(!option.combineFile){
              console.error('no output combined file');
              process.exit(1);
            }
            makeCombinedPumlFile(option.combineFile, combinedPumlString, arg.output, option.makeimage, option.makelocal);
          } else {
            outputFileNum++;
          }
        })
        .catch((err: Error) => {
          if(err) {
            return console.log(err);
          }
        });
    });
  });
program.parse(process.argv);

function getPlantUmlData(filepath: string) {
  return tsuml.TypeScriptUml.generateClassDiagram(
    tsuml.TypeScriptUml.parseFile(filepath, ts.ScriptTarget.ES5),
    {
      formatter: 'plantuml',
      plantuml: {
        diagramTags: false,
      },
    },
  )
}

function makeCombinedPumlFile(combinedFile: string, combinedPumlString: string,outputDir: string, isMakeImage: boolean | undefined, isLocal: boolean | undefined) {
  const outFileList: string[] = glob.sync(path.join(outputDir, '**/*.puml'));
  const pathListString: string = makeCombinedPathList(outFileList, combinedFile);
  fs.outputFile(combinedFile, addUmlTagString(pathListString))
    .then(() => {
      if(isMakeImage) {
        const imageFile: string = path.join(
          process.cwd(),
          path.dirname(combinedFile),
          path.basename(combinedFile, path.extname(combinedFile)) + '.png'
        );
        makeImage(combinedPumlString, imageFile, isLocal, combinedFile);
      }
    })
    .catch((err: Error) => {
      if(err) {
        return console.log(err);
      }
    });
}

function makeCombinedPathList(pathList: string[], combinedFile: string): string {
  const includePathList: string[] = [];
  pathList.forEach((item: string) => {
    includePathList.push(`!include ${path.resolve(path.join(process.cwd(), combinedFile), path.join(process.cwd(), item))}`);
  });
  return includePathList.join('\n');
}

function makeImage(umlData: string, outFile: string, makeLocal: boolean | undefined, umlFilePath: string): void {
  if(makeLocal) {
    const gen = puml.generate(umlFilePath);
    gen.out.pipe(fs.createWriteStream(umlFilePath.replace('.puml', '.png')));
  } else {
    request({
      method: 'GET',
      url: `http://www.plantuml.com/plantuml/png/${pumlenc.encode(umlData)}`,
      encoding: null
    }, (error: Error, response: any, body: any) => {
      if(!error && response.statusCode === 200){
        fs.outputFile(outFile, body, 'binary')
          .catch((err: Error) => {
            if(err) {
              return console.log(err);
            }
          });

      }
    });
  }
  return;
}

function addUmlTagString(str: string): string {
  return `@startuml\n${str}\n@enduml`
}
