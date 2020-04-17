import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import babel from '@rollup/plugin-babel';
module.exports = [{
  input: 'src/read2.js',
  plugins: [
    commonjs(),
    babel({
      exclude: '**/node_modules/**'
    }),
  ],
  interop: true,
  output: {
    file: 'lib/trans.js',
    format: 'umd'
  }
}]