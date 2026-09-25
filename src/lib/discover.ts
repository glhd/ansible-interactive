import {loadHistory} from './history.js';
import {configuredInventory, findInventories, type InventoryCandidate} from './inventory.js';
import {findPlaybooks, type Playbook} from './playbooks.js';

export type Discovery = {
	history: string[][];
	inventories: InventoryCandidate[];
	playbooks: Playbook[];
};

type DiscoverOptions = {
	cwd: string;
	inventory: string[];
	playbook?: string;
	history: boolean;
};

/** Look for history, inventories and playbooks, skipping what the CLI already gave us. */
export async function discover(options: DiscoverOptions): Promise<Discovery> {
	const explicitInventory = options.inventory.length > 0;
	const [history, configured, found, playbooks] = await Promise.all([
		options.history ? loadHistory(options.cwd) : [],
		explicitInventory ? undefined : configuredInventory(options.cwd),
		explicitInventory ? [] : findInventories(options.cwd),
		options.playbook ? [] : findPlaybooks(options.cwd),
	]);

	const inventories = configured
		? [configured, ...found.filter(candidate => candidate.label !== configured.label)]
		: found;

	return {history, inventories, playbooks};
}
