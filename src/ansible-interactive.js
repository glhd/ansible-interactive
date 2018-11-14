'use strict';

const args = require('./args');
const replay = require('./replay');
const loadInventory = require('./load-inventory');
const loadGroups = require('./load-groups');
const loadPlaybook = require('./load-playbook');
const loadTags = require('./load-tags');
const loadMode = require('./load-mode');
const buildCommand = require('./build-command');
const runCommand = require('./run-command');

module.exports = async function() {
	const replay_command = await replay();
	if (replay_command) {
		await runCommand(replay_command); // FIXME
	}
	
	const inventory = await loadInventory(args.inventory);
	const groups = await loadGroups(inventory);
	const playbook = await loadPlaybook(args.playbook);
	const tags = await loadTags();
	const mode = await loadMode();
	
	const command = buildCommand({
		inventory,
		groups,
		playbook,
		tags,
		mode,
	});
	
	await runCommand(command);
};
