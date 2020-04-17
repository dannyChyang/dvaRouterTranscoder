#!/usr/bin/env node

const path = require('path');

var argv = require('yargs-parser')(process.argv.slice(2))

const targetDir = path.resolve(argv.dir || process.cwd());
console.log('targetDir', targetDir);
const outputDir = path.resolve(argv.output || path.resolve(targetDir, '../dist'));
console.log('outputDir', outputDir);

if (argv.v || argv.version) {
  console.log(require('./package').version);
  process.exit(0);
}
require(`./src/read`)(targetDir, outputDir)
