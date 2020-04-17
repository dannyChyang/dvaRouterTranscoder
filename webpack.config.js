const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');
module.exports = {
  mode: 'production',
  entry: {
    covert: './src/read.js',
    'covert.min': './src/read.js'
  },
  output: {
    path: path.resolve("./lib"),
    filename: '[name].js',
    library: 'dvaUpgrade',
    libraryExport: 'default',
    libraryTarget: "umd",
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        include: /\.min\.js$/
      }),
    ],
  },
  mode: 'none',
  node:{
    fs:'empty',
    child_process:'empty',
  }
}
