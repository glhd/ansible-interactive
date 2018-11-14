'use strict';

const process = require('process');
const spawn = require("child_process").spawn;
const c = require('ansi-colors');
const { saveHistory } = require('./history');

async function wait(timeout) {
	return new Promise(resolve => setTimeout(resolve, timeout));
}

async function confirm(command) {
	const check_mode = -1 !== command.indexOf('--check');
	const timeout = 2000;
	const cwd = process.cwd();
	
	console.log('');
	console.log('---------------------------------------------------------------------------');
	console.log(` Working Dir:  ${c.blue(cwd)}`);
	console.log(`     Command:  ${c.yellow(command)}`);
	console.log(`Ansible Mode:  ${check_mode ? c.green('Check Mode') : c.red('Live Mode (will apply changes)')}`);
	console.log('---------------------------------------------------------------------------');
	console.log('');
	
	if (!check_mode) {
		const seconds = Math.floor(timeout / 1000);
		console.log(c.red(`You have ${seconds}s to cancel before ansible runs in live mode`));
		await wait(timeout);
		console.log('');
	}
	
	return true;
}

async function execute(command) {
	return new Promise((resolve, reject) => {
		const opts = {
			cwd: process.cwd(),
			env: process.env,
			encoding: "utf8",
			shell: true,
			stdio: "inherit"
		};
		
		const binary = command.shift();
		const proc = spawn(binary, command, opts);
		
		proc.on('exit', resolve);
		proc.on('error', reject);
	});
}

module.exports = async function(command) {
	const command_line = command.join(' ');
	
	await confirm(command_line);
	await saveHistory(command);
	
	try {
		await execute(command);
		console.log('');
		process.exit(0);
	} catch (e) {
		console.log('');
		process.exit(1);
	}
};
