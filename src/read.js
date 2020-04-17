const traverse = require('@babel/traverse').default;
const types = require('@babel/types');
const fs = require('fs-extra');
const path = require('path');
const convertFile = require('./convertFile');

const { resolve } = path;
const t = types;

module.exports = function(targetDir, outputDir) {
  function read(readPath, files) {
    const stat = fs.statSync(readPath);
  //  if(/__tests__/.test(readPath)) return;
    if (stat.isDirectory()) {
      const dirInfo = fs.readdirSync(readPath);
      dirInfo.map(_path => {
        const resolvePath = resolve(readPath, _path);
        read(resolvePath, files);
      })
      return;
    }
    const filename = path.basename(readPath);
    const ext = path.extname(readPath);
    if (!/\.(js|jsx)/.test(ext)) return;
  //  if (/\.test\.(js|jsx)/.test(filename)) return;
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
}

