'use strict';

const fs = require('fs');
const yaml = require("js-yaml");
const glob = require('./glob-promise');

async function readTasks(files) {
	return Promise.all(files.map(filename => new Promise((resolve, reject) => {
		fs.readFile(filename, 'utf8', (err, data) => {
			return err
				? reject(err)
				: resolve(data);
		});
	})));
}

async function parseTasks(files) {
	return Promise.all(files.map(data => new Promise((resolve, reject) => {
		try {
			resolve(yaml.load(data));
		} catch (e) {
			return reject(e);
		}
	})));
}

function extractTags(all_tasks) {
	const found_tags = all_tasks.reduce((tags, tasks) => {
		return tasks.reduce((tags, task) => {
			// console.log(task.tags);
			return tags.concat(task.tags || []);
		}, tags);
	}, []);
	
	// De-duplicate and sort tags
	return found_tags
		.filter((tag, key) => found_tags.indexOf(tag) === key)
		.sort();
}

module.exports = async function() {
	const files = await glob('./**/tasks/*.yml');
	const data = await readTasks(files);
	const tasks = await parseTasks(data);
	const tags = extractTags(tasks);
	
	return tags;
};
