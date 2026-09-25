import {Box} from 'ink';
import type {ReactNode} from 'react';
import {Question} from './Answer.js';
import {type Option, Select} from './Select.js';

type Props<T> = {
	question: string;
	options: Option<T>[];
	multiple?: boolean;
	noneSelectedHint?: string;
	/** Shown between the question and the list */
	children?: ReactNode;
	onSubmit: (values: T[]) => void;
	onBack?: () => void;
};

/** A question followed by a list to pick from */
export function SelectPrompt<T>({question, children, ...select}: Props<T>) {
	return (
		<Box flexDirection="column">
			<Question>{question}</Question>
			{children}
			<Select {...select} />
		</Box>
	);
}
