import {SelectPrompt} from '../components/SelectPrompt.js';
import type {InventoryCandidate} from '../lib/inventory.js';

type Props = {
	candidates: InventoryCandidate[];
	onSubmit: (inventory: InventoryCandidate) => void;
	onBack?: () => void;
};

export function InventoryStep({candidates, onSubmit, onBack}: Props) {
	const options = candidates.map(candidate => ({label: candidate.label, hint: candidate.hint, value: candidate}));

	return (
		<SelectPrompt
			question="Which inventory would you like to use?"
			options={options}
			onSubmit={([inventory]) => onSubmit(inventory!)}
			onBack={onBack}
		/>
	);
}
