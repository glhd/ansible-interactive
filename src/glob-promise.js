'use strict';

const glob = require('glob');

module.exports = function(pattern) {
	return new Promise(((resolve, reject) => glob(pattern, (err, files) => err ? reject(err) : resolve(files))));
};
