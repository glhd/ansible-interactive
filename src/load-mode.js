'use strict';

const { prompt } = require('enquirer');

module.exports = async function() {
	const response = await prompt({
		type: 'select',
		name: 'mode',
		message: `What mode would you like to run in?`,
		choices: [
			{
				message: `Check mode (don't apply changes)`,
				value: 'check',
			}, {
				message: `Live mode (WARNING - will apply changes)`,
				value: 'live',
			}
		]
	});
	
	return response.mode;
};
