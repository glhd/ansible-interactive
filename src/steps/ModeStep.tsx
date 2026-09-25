import type {Option} from '../components/Select.js';
import {SelectPrompt} from '../components/SelectPrompt.js';
import type {Mode} from '../lib/command.js';

const OPTIONS: Option<Mode>[] = [
	{label: "Check mode (don't apply changes)", value: 'check', color: 'green'},
	{label: 'Live mode (WARNING: will apply changes)', value: 'live', color: 'red'},
];

type Props = {
	onSubmit: (mode: Mode) => void;
	onBack?: () => void;
};

export function ModeStep({onSubmit, onBack}: Props) {
	return (
		<SelectPrompt
			question="What mode would you like to run in?"
			options={OPTIONS}
			onSubmit={([mode]) => onSubmit(mode!)}
			onBack={onBack}
		/>
	);
}
