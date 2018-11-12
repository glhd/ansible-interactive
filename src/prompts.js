'use strict';

const loadInventory = require('./load-inventory');
const loadPlaybook = require('./load-playbook');
const loadTags = require('./load-tags');

module.exports = async function() {
	const inventory = await loadInventory();
	const tags = await loadTags();
	const playbook = await loadPlaybook();
	
	console.log(playbook, inventory, tags);
};


