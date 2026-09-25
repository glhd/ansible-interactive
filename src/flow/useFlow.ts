import {useEffect, useReducer} from 'react';
import {discover} from '../lib/discover.js';
import {loadInventory} from '../lib/inventory.js';
import {loadTags} from '../lib/tags.js';
import {type Action, type FlowOptions, initialState, reducer, type State, type Task} from './state.js';

/** The flow's state, plus the async work each state asks for. */
export function useFlow(options: FlowOptions): [State, (action: Action) => void] {
	const [state, dispatch] = useReducer(reducer, options, initialState);

	useEffect(() => {
		const {task} = state;
		if (!task) {
			return;
		}

		let cancelled = false;
		const send = (action: Action) => {
			if (!cancelled) {
				dispatch(action);
			}
		};

		run(task, options).then(send, (error: unknown) => {
			send(
				task.kind === 'tags'
					? {type: 'tagsFailed', message: messageOf(error)}
					: {type: 'failed', error: error instanceof Error ? error : new Error(String(error))},
			);
		});

		return () => {
			cancelled = true;
		};
	}, [state.task]);

	return [state, dispatch];
}

async function run(task: Task, options: FlowOptions): Promise<Action> {
	switch (task.kind) {
		case 'discover':
			return {type: 'discovered', discovery: await discover(options)};

		case 'inventory':
			return {type: 'inventoryLoaded', contents: await loadInventory(task.inventory.sources, options.cwd)};

		case 'tags':
			return {type: 'tagsLoaded', tags: await loadTags(task.inventory, task.playbook.file, options.cwd)};
	}
}

/** Spinner text for a task */
export function taskLabel(task: Task): string {
	switch (task.kind) {
		case 'discover':
			return 'Looking for inventories and playbooks…';
		case 'inventory':
			return `Reading inventory ${task.inventory.label}…`;
		case 'tags':
			return `Reading tags from ${task.playbook.file}…`;
	}
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
