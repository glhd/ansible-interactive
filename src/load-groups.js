'use strict';

const { prompt } = require('enquirer');

async function limitGroups() {
	const response = await prompt({
		type: 'confirm',
		name: 'limit_groups',
		message: `Would you like to choose specific hosts to provision?`,
		initial: true,
	});
	
	return response.limit_groups;
}

module.exports = async function(inventory) {
	const limit_groups = await limitGroups();
	
	let groups = [];
	if (limit_groups) {
		const response = await prompt({
			type: 'multiselect',
			name: 'groups',
			message: `Which hosts would you like to provision?`,
			choices: inventory.groups,
			validate: groups => groups.length ? true : 'Please select at least one host!',
		});
		
		groups = response.groups;
	}
	
	return {
		limit_groups,
		groups,
	};
};
