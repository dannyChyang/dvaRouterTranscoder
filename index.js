if(process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/covert.min.js');
} else {
  module.exports = require('./dist/covert.js');
}