const babylon = require('babylon');
const traverse = require('@babel/traverse').default;
const types = require('@babel/types');
const template = require('@babel/template').default;
const generate = require("@babel/generator").default;
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const convertFile = require('./convertFile');

const { resolve } = path;
const t = types;
var argv = require('yargs-parser')(process.argv.slice(2))

const targetDir = path.resolve(argv.dir);
const outputDir = path.resolve(argv.output || './dist');

function read(readPath, files) {
  const stat = fs.statSync(readPath);
  if (stat.isDirectory()) {
    const dirInfo = fs.readdirSync(readPath);
    dirInfo.map(_path => {
      const resolvePath = resolve(readPath, _path);
      read(resolvePath, files);
    })
    return;
  }
  const ext = path.extname(readPath);
  if (!/\.(js|jsx)/.test(ext)) return;
  files.push(readPath);
}

const jsFiles = [];
read(targetDir, jsFiles);

function *fetch() {
  let r;
  while (r = jsFiles.shift()) {
    yield convertFile(r,targetDir, outputDir);
  }
  return;
}

function run(gen) {
  const g = gen();

  function next() {
    var result = g.next();
    if (result.done) return result.value;
    result.value.then(function(data) {
      next();
    });
  }

  next();
}

run(fetch);

