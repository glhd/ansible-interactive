'use strict';

const args = require('./args');
const loadInventory = require('./load-inventory');
const loadGroups = require('./load-groups');
const loadPlaybook = require('./load-playbook');
const loadTags = require('./load-tags');
const loadMode = require('./load-mode');
const buildCommand = require('./build-command');

module.exports = async function() {
	const inventory = await loadInventory(args.inventory);
	const groups = await loadGroups(inventory);
	const playbook = await loadPlaybook(args.playbook);
	const tags = await loadTags();
	const mode = await loadMode();
	
	const command = buildCommand(
		groups,
		inventory,
		playbook,
		tags,
		mode
	);
	
	console.log('');
	console.log(command);
	console.log('');
};


// For saving history
// const homedir = require('os').homedir();
