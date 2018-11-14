'use strict';

const { prompt } = require('enquirer');
const c = require('ansi-colors');

module.exports = async function() {
	const check = `Check mode (don't apply changes)`;
	const live = `Live mode (WARNING - will apply changes)`;
	
	const response = await prompt({
		type: 'select',
		name: 'mode',
		message: `What mode would you like to run in?`,
		choices: [
			{
				message: c.green(check),
				value: check,
			}, {
				message: c.red(live),
				value: live,
			}
		]
	});
	
	return live === response.mode
		? 'live'
		: 'check';
};
