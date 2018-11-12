'use strict';

module.exports = function(groups, inventory, playbook, tags, mode) {
	const command = ['ansible-playbook'];
	
	// Add inventory file
	command.push('-i', inventory.filename);
	
	// Check mode
	if ('live' !== mode) {
		command.push('--check');
	}
	
	// Always show diff
	command.push('--diff');
	
	// Tags
	if (tags.limit_tags) {
		const tag_list = tags.tags.join(',');
		command.push(`--tags='${tag_list}'`);
	}
	
	// Hosts
	if (groups.limit_groups) {
		const group_list = groups.groups.join(',');
		command.push(`--limit='${group_list}'`);
	}
	
	// Playbook
	command.push(playbook.filename);
	
	// Build final command string
	return command.join(' ');
};
