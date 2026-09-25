import {Box, Text, useApp} from 'ink';
import {useEffect} from 'react';
import {Confirm} from './components/Confirm.js';
import {Spinner} from './components/Spinner.js';
import {Summary} from './components/Summary.js';
import type {FlowOptions, Prompt} from './flow/state.js';
import {taskLabel, useFlow} from './flow/useFlow.js';
import {InventoryStep} from './steps/InventoryStep.js';
import {LimitStep} from './steps/LimitStep.js';
import {ModeStep} from './steps/ModeStep.js';
import {PlaybookStep} from './steps/PlaybookStep.js';
import {ReplayStep} from './steps/ReplayStep.js';
import {TagsStep} from './steps/TagsStep.js';

export type AppOptions = FlowOptions & {
	/** Seconds to wait before a live run starts */
	delay: number;
};

type Props = {
	options: AppOptions;
	onDone: (argv: string[]) => void;
};

export function App({options, onDone}: Props) {
	const {exit} = useApp();
	const [state, dispatch] = useFlow(options);
	const {prompt, task, error} = state;

	// Exit after the error has rendered
	useEffect(() => {
		if (error) {
			exit(error);
		}
	}, [error]);

	const onBack = state.history.length > 0 ? () => dispatch({type: 'back'}) : undefined;

	const renderPrompt = (current: Prompt) => {
		switch (current.step) {
			case 'replay':
				return (
					<ReplayStep
						last={current.last}
						onSubmit={choice => dispatch({type: 'chooseReplay', choice})}
						onBack={onBack}
					/>
				);
			case 'inventory':
				return (
					<InventoryStep
						candidates={current.candidates}
						onSubmit={inventory => dispatch({type: 'chooseInventory', inventory})}
						onBack={onBack}
					/>
				);
			case 'limit':
				return (
					<LimitStep
						contents={current.contents}
						onSubmit={limit => dispatch({type: 'chooseLimit', limit})}
						onBack={onBack}
					/>
				);
			case 'playbook':
				return (
					<PlaybookStep
						playbooks={current.playbooks}
						onSubmit={playbook => dispatch({type: 'choosePlaybook', playbook})}
						onBack={onBack}
					/>
				);
			case 'tags':
				return (
					<TagsStep
						tags={current.tags}
						onSubmit={tags => dispatch({type: 'chooseTags', tags})}
						onBack={onBack}
					/>
				);
			case 'mode':
				return (
					<ModeStep
						onSubmit={mode => dispatch({type: 'chooseMode', mode})}
						onBack={onBack}
					/>
				);
			case 'confirm':
				return (
					<Confirm
						argv={current.command}
						cwd={options.cwd}
						delay={options.delay}
						onConfirm={() => {
							onDone(current.command);
							exit();
						}}
						onBack={onBack}
					/>
				);
		}
	};

	return (
		<Box flexDirection="column">
			<Summary answers={state.answers} />
			{task && <Spinner label={taskLabel(task)} />}
			{error && <Text color="red">✖ {error.message}</Text>}
			{prompt && (
				// Keyed so each prompt starts with fresh state
				<Box key={`${state.history.length}-${prompt.step}`}>{renderPrompt(prompt)}</Box>
			)}
		</Box>
	);
}
