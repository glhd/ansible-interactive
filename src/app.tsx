import {Box, Text, useApp} from 'ink';
import {useEffect, useState} from 'react';
import {Answer, Question} from './components/Answer.js';
import {Confirm} from './components/Confirm.js';
import {type Option, Select} from './components/Select.js';
import {Spinner} from './components/Spinner.js';
import {buildCommand, formatCommand, type Mode, withMode} from './lib/command.js';
import {loadHistory} from './lib/history.js';
import {
	configuredInventory,
	findInventories,
	type InventoryCandidate,
	type InventoryContents,
	loadInventory,
} from './lib/inventory.js';
import {findPlaybooks, type Playbook} from './lib/playbooks.js';
import {loadTags} from './lib/tags.js';

export type AppOptions = {
	cwd: string;
	inventory: string[];
	playbook?: string;
	extra: string[];
	history: boolean;
	/** Seconds to wait before a live run starts */
	delay: number;
};

type Props = {
	options: AppOptions;
	onDone: (argv: string[]) => void;
};

type Step = 'replay' | 'inventory' | 'limit' | 'playbook' | 'tags' | 'mode' | 'confirm';

// Answers belonging to each step, cleared when the user goes back to it
const STEP_ORDER: Step[] = ['replay', 'inventory', 'limit', 'playbook', 'tags', 'mode', 'confirm'];

type Discovery = {
	history: string[][];
	inventories: InventoryCandidate[];
	playbooks: Playbook[];
};

type Answers = {
	inventory?: InventoryCandidate;
	contents?: InventoryContents;
	limit?: string[];
	playbook?: Playbook;
	availableTags?: string[];
	tagWarning?: string;
	tags?: string[];
	mode?: Mode;
	command?: string[];
};

const STEP_ANSWERS: Record<Step, (keyof Answers)[]> = {
	replay: ['command'],
	inventory: ['inventory', 'contents'],
	limit: ['limit'],
	playbook: ['playbook', 'availableTags', 'tagWarning'],
	tags: ['tags'],
	mode: ['mode', 'command'],
	confirm: [],
};

type ReplayChoice = 'new' | Mode;

export function App({options, onDone}: Props) {
	const {exit} = useApp();
	const [discovery, setDiscovery] = useState<Discovery>();
	const [answers, setAnswers] = useState<Answers>({});
	// Interactive steps the user has seen; the last one is the current step
	const [stack, setStack] = useState<Step[]>([]);
	const [loading, setLoading] = useState<string | undefined>('Looking for inventories and playbooks…');
	const [error, setError] = useState<Error>();

	const step = stack.at(-1);

	const fail = (reason: unknown) => {
		const err = reason instanceof Error ? reason : new Error(String(reason));
		setLoading(undefined);
		setError(err);
	};

	// Exit after the error has rendered
	useEffect(() => {
		if (error) {
			exit(error);
		}
	}, [error]);

	const answer = (next: Answers) => setAnswers(current => ({...current, ...next}));
	const show = (next: Step) => {
		setLoading(undefined);
		setStack(current => [...current, next]);
	};

	const back = () => {
		if (stack.length < 2) {
			return;
		}

		const previous = stack.at(-2)!;
		const cleared = STEP_ORDER.slice(STEP_ORDER.indexOf(previous)).flatMap(s => STEP_ANSWERS[s]);
		setAnswers(current => {
			const next = {...current};
			for (const key of cleared) {
				delete next[key];
			}

			return next;
		});
		setStack(current => current.slice(0, -1));
	};

	// --- Step transitions -------------------------------------------------

	const startNew = (found: Discovery) => {
		if (options.inventory.length > 0) {
			chooseInventory({sources: options.inventory, label: options.inventory.join(', ')});
		} else if (found.inventories.length === 0) {
			fail(new Error('No inventory found in this directory. Pass one with --inventory (-i).'));
		} else if (found.inventories.length === 1) {
			chooseInventory(found.inventories[0]!);
		} else {
			show('inventory');
		}
	};

	const chooseInventory = (inventory: InventoryCandidate) => {
		answer({inventory});
		setLoading(`Reading inventory ${inventory.label}…`);
		loadInventory(inventory.sources, options.cwd)
			.then(contents => {
				answer({contents});
				show('limit');
			})
			.catch(fail);
	};

	const chooseLimit = (limit: string[]) => {
		answer({limit});

		const playbooks = discovery?.playbooks ?? [];
		if (options.playbook) {
			choosePlaybook({file: options.playbook});
		} else if (playbooks.length === 0) {
			fail(new Error('No playbooks found in this directory. Pass one with --playbook (-p).'));
		} else if (playbooks.length === 1) {
			choosePlaybook(playbooks[0]!);
		} else {
			show('playbook');
		}
	};

	const choosePlaybook = (playbook: Playbook) => {
		answer({playbook});
		setLoading(`Reading tags from ${playbook.file}…`);
		loadTags(answers.inventory?.sources ?? options.inventory, playbook.file, options.cwd)
			.then(availableTags => {
				answer({availableTags});
				if (availableTags.length > 0) {
					show('tags');
				} else {
					answer({tags: []});
					show('mode');
				}
			})
			.catch((err: unknown) => {
				const message = err instanceof Error ? err.message : String(err);
				answer({tags: [], tagWarning: `Could not list tags, running all of them.\n${message}`});
				show('mode');
			});
	};

	const chooseMode = (mode: Mode) => {
		const command = buildCommand({
			inventory: answers.inventory?.sources ?? [],
			playbook: answers.playbook!.file,
			limit: answers.limit ?? [],
			tags: answers.tags ?? [],
			mode,
			extra: options.extra,
		});
		answer({mode, command});
		show('confirm');
	};

	const chooseReplay = (choice: ReplayChoice) => {
		if (choice === 'new') {
			// Keep the replay step on the stack so esc can return to it
			startNew(discovery!);
			return;
		}

		answer({command: withMode(discovery!.history[0]!, choice)});
		show('confirm');
	};

	// --- Discovery --------------------------------------------------------

	useEffect(() => {
		const discover = async (): Promise<Discovery> => {
			const [history, configured, found, playbooks] = await Promise.all([
				options.history ? loadHistory(options.cwd) : Promise.resolve([]),
				options.inventory.length > 0 ? undefined : configuredInventory(options.cwd),
				options.inventory.length > 0 ? [] : findInventories(options.cwd),
				options.playbook ? [] : findPlaybooks(options.cwd),
			]);

			const inventories = configured
				? [configured, ...found.filter(candidate => candidate.label !== configured.label)]
				: found;

			return {history, inventories, playbooks};
		};

		discover()
			.then(found => {
				setDiscovery(found);
				const explicit = options.inventory.length > 0 || options.playbook;
				if (found.history.length > 0 && !explicit) {
					show('replay');
				} else {
					startNew(found);
				}
			})
			.catch(fail);
	}, []);

	// --- Rendering --------------------------------------------------------

	const answered = (
		<>
			{answers.inventory && <Answer label="Inventory" value={answers.inventory.label} />}
			{answers.limit && (
				<Answer label="Limit" value={answers.limit.length > 0 ? answers.limit.join(', ') : 'all hosts'} />
			)}
			{answers.playbook && <Answer label="Playbook" value={answers.playbook.file} />}
			{answers.tagWarning && <Text color="yellow">⚠ {answers.tagWarning}</Text>}
			{answers.tags && answers.availableTags && answers.availableTags.length > 0 && (
				<Answer label="Tags" value={answers.tags.length > 0 ? answers.tags.join(', ') : 'all tags'} />
			)}
			{answers.mode && (
				<Answer label="Mode" value={answers.mode === 'live' ? 'live (applies changes)' : 'check'} />
			)}
		</>
	);

	const onBack = stack.length > 1 ? back : undefined;

	return (
		<Box flexDirection="column">
			{answered}
			{loading && <Spinner label={loading} />}
			{error && <Text color="red">✖ {error.message}</Text>}
			{!loading && !error && step && (
				// Keyed so each step starts with fresh prompt state
				<Box key={`${stack.length}-${step}`}>{renderStep(step)}</Box>
			)}
		</Box>
	);

	function renderStep(current: Step) {
		switch (current) {
			case 'replay': {
				const last = withMode(discovery!.history[0]!, 'live');
				const items: Option<ReplayChoice>[] = [
					{label: 'Run a new command', value: 'new'},
					{label: 'Re-run in check mode', value: 'check', color: 'green'},
					{label: 'Re-run in live mode', value: 'live', color: 'red'},
				];
				return (
					<Box flexDirection="column">
						<Question>What would you like to run?</Question>
						<Text dimColor>
							Last command: <Text color="yellow">{formatCommand(last)}</Text>
						</Text>
						<Select options={items} onSubmit={([choice]) => chooseReplay(choice!)} onBack={onBack} />
					</Box>
				);
			}

			case 'inventory': {
				const items = discovery!.inventories.map(candidate => ({
					label: candidate.label,
					hint: candidate.hint,
					value: candidate,
				}));
				return (
					<Box flexDirection="column">
						<Question>Which inventory would you like to use?</Question>
						<Select options={items} onSubmit={([choice]) => chooseInventory(choice!)} onBack={onBack} />
					</Box>
				);
			}

			case 'limit': {
				const {groups, hosts} = answers.contents!;
				const items: Option<string>[] = [
					...groups.map(group => ({
						label: group.name,
						hint: `group · ${group.hostCount} ${group.hostCount === 1 ? 'host' : 'hosts'}`,
						value: group.name,
					})),
					...hosts.map(host => ({label: host, hint: 'host', value: host})),
				];
				return (
					<Box flexDirection="column">
						<Question>Which hosts would you like to provision?</Question>
						<Select
							multiple
							options={items}
							noneSelectedHint="Nothing selected: all hosts"
							onSubmit={chooseLimit}
							onBack={onBack}
						/>
					</Box>
				);
			}

			case 'playbook': {
				const items = discovery!.playbooks.map(playbook => ({
					label: playbook.file,
					hint: playbook.name,
					value: playbook,
				}));
				return (
					<Box flexDirection="column">
						<Question>Which playbook would you like to run?</Question>
						<Select options={items} onSubmit={([choice]) => choosePlaybook(choice!)} onBack={onBack} />
					</Box>
				);
			}

			case 'tags': {
				const items = answers.availableTags!.map(tag => ({label: tag, value: tag}));
				return (
					<Box flexDirection="column">
						<Question>Which tags would you like to run?</Question>
						<Select
							multiple
							options={items}
							noneSelectedHint="Nothing selected: all tags"
							onSubmit={tags => {
								answer({tags});
								show('mode');
							}}
							onBack={onBack}
						/>
					</Box>
				);
			}

			case 'mode': {
				const items: Option<Mode>[] = [
					{label: "Check mode (don't apply changes)", value: 'check', color: 'green'},
					{label: 'Live mode (WARNING: will apply changes)', value: 'live', color: 'red'},
				];
				return (
					<Box flexDirection="column">
						<Question>What mode would you like to run in?</Question>
						<Select options={items} onSubmit={([mode]) => chooseMode(mode!)} onBack={onBack} />
					</Box>
				);
			}

			case 'confirm': {
				const command = answers.command!;
				return (
					<Confirm
						argv={command}
						cwd={options.cwd}
						delay={options.delay}
						onConfirm={() => {
							onDone(command);
							exit();
						}}
						onBack={onBack}
					/>
				);
			}
		}
	}
}
