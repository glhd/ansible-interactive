'use strict';

const { prompt } = require('enquirer');

const loadInventory = require('./load-inventory');

module.exports = async function() {
	const inventory = await loadInventory();
	
	console.log(inventory);
};


