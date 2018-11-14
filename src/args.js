'use strict';

const args = require('yargs')
	.usage('Usage: $0 [options]')
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
	.option('no-history', {
		default: false,
		boolean: true,
	})
	.argv;

module.exports = args;
