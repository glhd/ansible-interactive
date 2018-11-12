'use strict';

const fs = require('fs');
const path = require('path');
const ini = require('ini');
const { prompt } = require('enquirer');
const glob = require('./glob-promise');

function loadFileStats(files) {
	return Promise.all(files.map(filename => new Promise(resolve => {
		fs.lstat(filename, (err, stats) => {
			resolve({
				filename,
				is_directory: err ? false : stats.isDirectory(),
				is_file: err ? false : stats.isFile(),
				extension: path.extname(filename).toLowerCase(),
			});
		});
	})));
}

function filterFiles(files) {
	return files.filter(file => file.is_file && ('' === file.extension || '.ini' === file.extension));
}

function readFiles(files) {
	return Promise.all(files.map(file => new Promise(resolve => {
		fs.readFile(file.filename, 'utf8', (err, data) => resolve({ ...file, err, data }));
	})));
}

function parseFiles(files) {
	return files.map(file => ({
			filename: file.filename,
			ini: file.err ? false : ini.decode(file.data),
		}))
		.filter(file => file.ini)
		.map(file => ({
			...file,
			groups: Object.keys(file.ini).map(group => group.replace(/:children$/, '')),
		}));
}

async function selectFile(files) {
	if (1 === files.length) {
		const file = files[0];
		const response = await prompt({
			type: 'confirm',
			name: 'confirmed',
			message: `Use "${file.filename}" inventory file?`,
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
		name: 'inventory',
		message: 'Which inventory file would you like to run?',
		choices,
	});
	
	const file = files.find(file => file.filename === response.inventory);
	
	if (!file) {
		throw 'Invalid selection';
	}
	
	return file;
}

module.exports = async function(file) {
	const files = file
		? [file]
		: await glob('*');
	const stats = await loadFileStats(files);
	const possibleInventories = filterFiles(stats);
	const inventoryContents = await readFiles(possibleInventories);
	const parsedInventories = parseFiles(inventoryContents);
	
	return selectFile(parsedInventories);
};
