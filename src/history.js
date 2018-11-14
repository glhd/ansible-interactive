'use strict';

const fs = require('fs');
const process = require('process');

function historyFile() {
	return `${process.cwd()}/.ansible-interactive-history`;
}

let history;

async function loadHistory() {
	return new Promise(resolve => {
		if (history) {
			return resolve(history);
		}
		
		const history_file = historyFile();
		fs.readFile(history_file, 'utf8', (err, data) => {
			history = err
				? []
				: JSON.parse(data);
			resolve(history);
		});
	});
}

async function saveHistory(command_to_save) {
	return new Promise(async (resolve, reject) => {
		let next_history = await loadHistory();
		const history_file = historyFile();
		
		next_history.unshift(command_to_save);
		
		if (next_history.length > 100) {
			next_history = next_history.splice(0, 99);
		}
		
		fs.writeFile(history_file, JSON.stringify(next_history), 'utf8', err => err ? reject(err) : resolve(true));
		history = [...next_history];
	});
}

module.exports = {
	loadHistory,
	saveHistory,
};
