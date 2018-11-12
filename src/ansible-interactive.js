'use strict';

const args = require('./args');
const loadInventory = require('./load-inventory');
const loadPlaybook = require('./load-playbook');
const loadTags = require('./load-tags');
const loadMode = require('./load-mode');

module.exports = async function() {
	const inventory = await loadInventory(args.inventory);
	const playbook = await loadPlaybook(args.playbook);
	const tags = await loadTags();
	const mode = await loadMode();
	
	console.log(inventory, playbook, tags, mode);
};


// For saving history
// const homedir = require('os').homedir();
