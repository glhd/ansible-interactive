import {SelectPrompt} from '../components/SelectPrompt.js';
import type {Playbook} from '../lib/playbooks.js';

type Props = {
	playbooks: Playbook[];
	onSubmit: (playbook: Playbook) => void;
	onBack?: () => void;
};

export function PlaybookStep({playbooks, onSubmit, onBack}: Props) {
	const options = playbooks.map(playbook => ({label: playbook.file, hint: playbook.name, value: playbook}));

	return (
		<SelectPrompt
			question="Which playbook would you like to run?"
			options={options}
			onSubmit={([playbook]) => onSubmit(playbook!)}
			onBack={onBack}
		/>
	);
}
