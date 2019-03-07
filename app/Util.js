const _ = require('lodash')

module.exports.isEmpty = function (val) {
  if (_.isNumber(val) || _.isBoolean(val)) {
    return false
  }

  return _.isEmpty(val)
}

module.exports.ja2Bit = function ( str ) {
  return ( str.match(/^[\u30a0-\u30ff\u3040-\u309f\u3005-\u3006\u30e0-\u9fcf]+$/) )? true : false
}
