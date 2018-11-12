'use strict';

const loadInventory = require('./load-inventory');
const loadPlaybook = require('./load-playbook');
const loadTags = require('./load-tags');
const loadMode = require('./load-mode');

module.exports = async function() {
	// const inventory = await loadInventory();
	const tags = await loadTags();
	// const playbook = await loadPlaybook();
	// const mode = await loadMode();
	
	console.log(tags);
};


// For saving history
// const homedir = require('os').homedir();
