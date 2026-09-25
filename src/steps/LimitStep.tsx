import type {Option} from '../components/Select.js';
import {SelectPrompt} from '../components/SelectPrompt.js';
import type {InventoryContents} from '../lib/inventory.js';

type Props = {
	contents: InventoryContents;
	onSubmit: (limit: string[]) => void;
	onBack?: () => void;
};

export function LimitStep({contents, onSubmit, onBack}: Props) {
	const options: Option<string>[] = [
		...contents.groups.map(group => ({
			label: group.name,
			hint: `group · ${group.hostCount} ${group.hostCount === 1 ? 'host' : 'hosts'}`,
			value: group.name,
		})),
		...contents.hosts.map(host => ({label: host, hint: 'host', value: host})),
	];

	return (
		<SelectPrompt
			multiple
			question="Which hosts would you like to provision?"
			options={options}
			noneSelectedHint="Nothing selected: all hosts"
			onSubmit={onSubmit}
			onBack={onBack}
		/>
	);
}
