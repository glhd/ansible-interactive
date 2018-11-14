'use strict';

const c = require('ansi-colors');
const { prompt } = require('enquirer');
const { loadHistory } = require('./history');

module.exports = async function() {
	const history = await loadHistory();
	
	if (!history.length) {
		return undefined;
	}
	
	const last_command = history[0].filter(arg => '--check' !== arg);
	const last_command_string = last_command.join(' ');
	
	const run_new = 'Run a new command';
	const rerun_check = 'Re-run last command in check mode';
	const rerun_live = 'Re-run last command in live mode';
	
	const response = await prompt({
		type: 'select',
		name: 'history',
		message: 'What would you like to run?',
		choices: [
			{
				message: 'Run a new command',
				value: run_new,
			}, {
				message: `Run "${c.yellow(last_command_string)}" again in ${c.green('check mode')}`,
				value: rerun_check,
			}, {
				message: `Run "${c.yellow(last_command_string)}" again in ${c.bold.red('live mode')}`,
				value: rerun_live,
			}
		]
	});
	
	if (rerun_check === response.history) {
		return [...last_command, '--check'];
	}
	
	if (rerun_live === response.history) {
		return last_command;
	}
	
	return undefined;
};
