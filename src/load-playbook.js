'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { prompt } = require('enquirer');
const glob = require('./glob-promise');

async function readPlaybooks(files) {
	return Promise.all(files.map(filename => new Promise((resolve, reject) => {
		fs.readFile(filename, 'utf8', (err, data) => {
			return err
				? reject(err)
				: resolve({ filename, data });
		});
	})));
}

async function parsePlaybooks(files) {
	return Promise.all(files.map(file => new Promise((resolve, reject) => {
		try {
			resolve({
				filename: file.filename,
				plays: yaml.load(file.data),
			});
		} catch (e) {
			return reject(e);
		}
	})));
}

async function selectPlaybook(files) {
	if (1 === files.length) {
		const file = files[0];
		const response = await prompt({
			type: 'confirm',
			name: 'confirmed',
			message: `Use "${file.filename}" playbook?`,
			initial: true,
		});
		
		if (response.confirmed) {
			return file;
		}
		
		throw `Aborted — declined to use "${file.filename}"`;
	}
	
	const choices = files.map(file => ({ message: file.filename }));
	
	const response = await prompt({
		type: 'select',
		name: 'playbook',
		message: 'Which playbook would you like to run?',
		choices,
	});
	
	const file = files.find(file => file.filename === response.playbook);
	
	if (!file) {
		throw 'Invalid selection';
	}
	
	return file;
}

module.exports = async function(file) {
	const files = file
		? [file]
		: await glob('*.+(yml|yaml)');
	const file_data = await readPlaybooks(files);
	const playbooks = await parsePlaybooks(file_data);
	
	return selectPlaybook(playbooks);
};
