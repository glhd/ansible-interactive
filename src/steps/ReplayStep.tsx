import {Text} from 'ink';
import type {Option} from '../components/Select.js';
import {SelectPrompt} from '../components/SelectPrompt.js';
import {formatCommand, withMode} from '../lib/command.js';
import type {ReplayChoice} from '../flow/state.js';

const OPTIONS: Option<ReplayChoice>[] = [
	{label: 'Run a new command', value: 'new'},
	{label: 'Re-run in check mode', value: 'check', color: 'green'},
	{label: 'Re-run in live mode', value: 'live', color: 'red'},
];

type Props = {
	last: string[];
	onSubmit: (choice: ReplayChoice) => void;
	onBack?: () => void;
};

export function ReplayStep({last, onSubmit, onBack}: Props) {
	return (
		<SelectPrompt
			question="What would you like to run?"
			options={OPTIONS}
			onSubmit={([choice]) => onSubmit(choice!)}
			onBack={onBack}
		>
			<Text dimColor>
				Last command: <Text color="yellow">{formatCommand(withMode(last, 'live'))}</Text>
			</Text>
		</SelectPrompt>
	);
}
