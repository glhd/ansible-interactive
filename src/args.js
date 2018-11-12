'use strict';

const pkg = require(`${__dirname}/../package.json`);

const args = require('yargs')
	.usage('Usage: $0 [options]')
	.version(pkg.version || 'beta')
	.option('inventory', {
		alias: 'i',
		default: false,
		string: true,
	})
	.option('playbook', {
		alias: 'p',
		default: false,
		string: true,
	})
	.option('verbose', {
		alias: 'v',
		default: false,
		boolean: true,
	})
	.argv;

module.exports = args;
