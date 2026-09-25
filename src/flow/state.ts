import {buildCommand, type Mode, withMode} from '../lib/command.js';
import type {Discovery} from '../lib/discover.js';
import type {InventoryCandidate, InventoryContents} from '../lib/inventory.js';
import type {Playbook} from '../lib/playbooks.js';

export type FlowOptions = {
	cwd: string;
	/** Inventory sources from --inventory */
	inventory: string[];
	/** Playbook from --playbook */
	playbook?: string;
	/** Arguments after "--" */
	extra: string[];
	history: boolean;
};

export type ReplayChoice = 'new' | Mode;

/** The prompt on screen, with the data it needs */
export type Prompt =
	| {step: 'replay'; last: string[]}
	| {step: 'inventory'; candidates: InventoryCandidate[]}
	| {step: 'limit'; contents: InventoryContents}
	| {step: 'playbook'; playbooks: Playbook[]}
	| {step: 'tags'; tags: string[]}
	| {step: 'mode'}
	| {step: 'confirm'; command: string[]};

/** Async work the flow is waiting on; useFlow runs it */
export type Task =
	| {kind: 'discover'}
	| {kind: 'inventory'; inventory: InventoryCandidate}
	| {kind: 'tags'; inventory: string[]; playbook: Playbook};

/** Everything answered so far, shown above the current prompt */
export type Answers = {
	inventory?: InventoryCandidate;
	contents?: InventoryContents;
	limit?: string[];
	playbook?: Playbook;
	availableTags?: string[];
	tagWarning?: string;
	tags?: string[];
	mode?: Mode;
};

type Snapshot = {prompt: Prompt; answers: Answers};

export type State = {
	options: FlowOptions;
	discovery?: Discovery;
	answers: Answers;
	prompt?: Prompt;
	task?: Task;
	error?: Error;
	/** Prompts already answered, newest last, so esc can return to them */
	history: Snapshot[];
};

export type Action =
	| {type: 'discovered'; discovery: Discovery}
	| {type: 'inventoryLoaded'; contents: InventoryContents}
	| {type: 'tagsLoaded'; tags: string[]}
	| {type: 'tagsFailed'; message: string}
	| {type: 'failed'; error: Error}
	| {type: 'chooseReplay'; choice: ReplayChoice}
	| {type: 'chooseInventory'; inventory: InventoryCandidate}
	| {type: 'chooseLimit'; limit: string[]}
	| {type: 'choosePlaybook'; playbook: Playbook}
	| {type: 'chooseTags'; tags: string[]}
	| {type: 'chooseMode'; mode: Mode}
	| {type: 'back'};

export function initialState(options: FlowOptions): State {
	return {options, answers: {}, history: [], task: {kind: 'discover'}};
}

export function reducer(state: State, action: Action): State {
	switch (action.type) {
		case 'discovered': {
			const next = {...state, discovery: action.discovery};
			const {inventory, playbook} = state.options;
			const explicit = inventory.length > 0 || playbook !== undefined;
			const last = action.discovery.history[0];
			return last && !explicit ? show(next, {step: 'replay', last}) : startNew(next);
		}

		case 'inventoryLoaded':
			return show(answer(state, {contents: action.contents}), {step: 'limit', contents: action.contents});

		case 'tagsLoaded': {
			const next = answer(state, {availableTags: action.tags});
			return action.tags.length > 0
				? show(next, {step: 'tags', tags: action.tags})
				: show(answer(next, {tags: []}), {step: 'mode'});
		}

		case 'tagsFailed':
			return show(
				answer(state, {tags: [], tagWarning: `Could not list tags, running all of them.\n${action.message}`}),
				{step: 'mode'},
			);

		case 'failed':
			return fail(state, action.error);

		case 'back': {
			const previous = state.history.at(-1);
			if (!previous) {
				return state;
			}

			return {
				...state,
				...previous,
				task: undefined,
				history: state.history.slice(0, -1),
			};
		}

		default:
			return submit(state, action);
	}
}

type Submit = Extract<Action, {type: `choose${string}`}>;

/** Handle the user answering the current prompt */
function submit(current: State, action: Submit): State {
	// Remember the prompt being answered so esc can come back to it
	const state: State = current.prompt
		? {...current, history: [...current.history, {prompt: current.prompt, answers: current.answers}]}
		: current;

	switch (action.type) {
		case 'chooseReplay': {
			if (action.choice === 'new') {
				return startNew(state);
			}

			const last = state.discovery?.history[0];
			return last ? show(state, {step: 'confirm', command: withMode(last, action.choice)}) : state;
		}

		case 'chooseInventory':
			return loadInventory(state, action.inventory);

		case 'chooseLimit':
			return pickPlaybook(answer(state, {limit: action.limit}));

		case 'choosePlaybook':
			return loadTags(state, action.playbook);

		case 'chooseTags':
			return show(answer(state, {tags: action.tags}), {step: 'mode'});

		case 'chooseMode': {
			const {answers, options} = state;
			if (!answers.playbook) {
				return fail(state, new Error('No playbook chosen'));
			}

			const command = buildCommand({
				inventory: answers.inventory?.sources ?? [],
				playbook: answers.playbook.file,
				limit: answers.limit ?? [],
				tags: answers.tags ?? [],
				mode: action.mode,
				extra: options.extra,
			});
			return show(answer(state, {mode: action.mode}), {step: 'confirm', command});
		}
	}
}

// --- Transitions ----------------------------------------------------------

/** Pick an inventory: from --inventory, the only one found, or ask */
function startNew(state: State): State {
	const {inventory} = state.options;
	const candidates = state.discovery?.inventories ?? [];

	if (inventory.length > 0) {
		return loadInventory(state, {sources: inventory, label: inventory.join(', ')});
	}

	if (candidates.length === 0) {
		return fail(state, new Error('No inventory found in this directory. Pass one with --inventory (-i).'));
	}

	return candidates.length === 1
		? loadInventory(state, candidates[0]!)
		: show(state, {step: 'inventory', candidates});
}

/** Pick a playbook: from --playbook, the only one found, or ask */
function pickPlaybook(state: State): State {
	const {playbook} = state.options;
	const playbooks = state.discovery?.playbooks ?? [];

	if (playbook) {
		return loadTags(state, {file: playbook});
	}

	if (playbooks.length === 0) {
		return fail(state, new Error('No playbooks found in this directory. Pass one with --playbook (-p).'));
	}

	return playbooks.length === 1 ? loadTags(state, playbooks[0]!) : show(state, {step: 'playbook', playbooks});
}

function loadInventory(state: State, inventory: InventoryCandidate): State {
	return {...answer(state, {inventory}), prompt: undefined, task: {kind: 'inventory', inventory}};
}

function loadTags(state: State, playbook: Playbook): State {
	const inventory = state.answers.inventory?.sources ?? state.options.inventory;
	return {...answer(state, {playbook}), prompt: undefined, task: {kind: 'tags', inventory, playbook}};
}

function show(state: State, prompt: Prompt): State {
	return {...state, prompt, task: undefined};
}

function answer(state: State, answers: Answers): State {
	return {...state, answers: {...state.answers, ...answers}};
}

function fail(state: State, error: Error): State {
	return {...state, error, prompt: undefined, task: undefined};
}
