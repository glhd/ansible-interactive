import {describe, expect, it} from 'vitest';
import type {Discovery} from '../lib/discover.js';
import type {InventoryContents} from '../lib/inventory.js';
import {type Action, type FlowOptions, initialState, reducer, type State} from './state.js';

const options: FlowOptions = {cwd: '/project', inventory: [], extra: [], history: true};

const staging = {sources: ['staging'], label: 'staging'};
const production = {sources: ['production'], label: 'production'};
const contents: InventoryContents = {groups: [{name: 'web', hostCount: 2}], hosts: ['web1', 'web2']};

const discovery = (overrides: Partial<Discovery> = {}): Discovery => ({
	history: [],
	inventories: [staging, production],
	playbooks: [{file: 'site.yml'}, {file: 'deploy.yml'}],
	...overrides,
});

function run(actions: Action[], flowOptions = options): State {
	return actions.reduce(reducer, initialState(flowOptions));
}

describe('flow', () => {
	it('walks every step to a command', () => {
		const state = run([
			{type: 'discovered', discovery: discovery()},
			{type: 'chooseInventory', inventory: staging},
			{type: 'inventoryLoaded', contents},
			{type: 'chooseLimit', limit: ['web']},
			{type: 'choosePlaybook', playbook: {file: 'site.yml'}},
			{type: 'tagsLoaded', tags: ['deploy', 'nginx']},
			{type: 'chooseTags', tags: ['deploy']},
			{type: 'chooseMode', mode: 'check'},
		]);

		expect(state.prompt).toEqual({
			step: 'confirm',
			command: [
				'ansible-playbook',
				'-i',
				'staging',
				'--check',
				'--diff',
				'--tags',
				'deploy',
				'--limit',
				'web',
				'site.yml',
			],
		});
	});

	it('waits on async work between prompts', () => {
		let state = run([{type: 'discovered', discovery: discovery()}]);
		expect(state.task).toBeUndefined();
		expect(state.prompt?.step).toBe('inventory');

		state = reducer(state, {type: 'chooseInventory', inventory: staging});
		expect(state.prompt).toBeUndefined();
		expect(state.task).toEqual({kind: 'inventory', inventory: staging});

		state = reducer(state, {type: 'inventoryLoaded', contents});
		expect(state.task).toBeUndefined();
		expect(state.prompt).toEqual({step: 'limit', contents});
	});

	it('skips prompts with only one choice', () => {
		const state = run([
			{
				type: 'discovered',
				discovery: discovery({inventories: [staging], playbooks: [{file: 'site.yml'}]}),
			},
		]);
		expect(state.task).toEqual({kind: 'inventory', inventory: staging});

		const next: Action[] = [
			{type: 'inventoryLoaded', contents},
			{type: 'chooseLimit', limit: []},
		];
		expect(next.reduce(reducer, state).task).toEqual({
			kind: 'tags',
			inventory: ['staging'],
			playbook: {file: 'site.yml'},
		});
	});

	it('skips the tags prompt when there are none', () => {
		const state = run([
			{type: 'discovered', discovery: discovery()},
			{type: 'chooseInventory', inventory: staging},
			{type: 'inventoryLoaded', contents},
			{type: 'chooseLimit', limit: []},
			{type: 'choosePlaybook', playbook: {file: 'site.yml'}},
			{type: 'tagsLoaded', tags: []},
		]);

		expect(state.prompt).toEqual({step: 'mode'});
		expect(state.answers.tags).toEqual([]);
	});

	it('runs all tags with a warning when they cannot be listed', () => {
		const state = run([
			{type: 'discovered', discovery: discovery()},
			{type: 'chooseInventory', inventory: staging},
			{type: 'inventoryLoaded', contents},
			{type: 'chooseLimit', limit: []},
			{type: 'choosePlaybook', playbook: {file: 'site.yml'}},
			{type: 'tagsFailed', message: 'vault password required'},
		]);

		expect(state.prompt).toEqual({step: 'mode'});
		expect(state.answers.tagWarning).toContain('vault password required');
	});

	it('uses --inventory and --playbook without asking', () => {
		const flowOptions = {...options, inventory: ['hosts'], playbook: 'site.yml'};
		let state = run(
			[{type: 'discovered', discovery: discovery({history: [['ansible-playbook', 'old.yml']]})}],
			flowOptions,
		);

		// History exists, but explicit options skip the replay prompt
		expect(state.task).toEqual({kind: 'inventory', inventory: {sources: ['hosts'], label: 'hosts'}});

		const next: Action[] = [
			{type: 'inventoryLoaded', contents},
			{type: 'chooseLimit', limit: []},
		];
		state = next.reduce(reducer, state);
		expect(state.task).toEqual({kind: 'tags', inventory: ['hosts'], playbook: {file: 'site.yml'}});
	});

	it('fails when nothing is found', () => {
		expect(run([{type: 'discovered', discovery: discovery({inventories: []})}]).error?.message).toMatch(
			/No inventory found/,
		);

		const state = run([
			{type: 'discovered', discovery: discovery({playbooks: []})},
			{type: 'chooseInventory', inventory: staging},
			{type: 'inventoryLoaded', contents},
			{type: 'chooseLimit', limit: []},
		]);
		expect(state.error?.message).toMatch(/No playbooks found/);
		expect(state.prompt).toBeUndefined();
	});

	describe('back', () => {
		it('returns to the previous prompt and forgets later answers', () => {
			const atPlaybook = run([
				{type: 'discovered', discovery: discovery()},
				{type: 'chooseInventory', inventory: staging},
				{type: 'inventoryLoaded', contents},
				{type: 'chooseLimit', limit: ['web']},
			]);
			expect(atPlaybook.prompt?.step).toBe('playbook');

			const atLimit = reducer(atPlaybook, {type: 'back'});
			expect(atLimit.prompt?.step).toBe('limit');
			expect(atLimit.answers.limit).toBeUndefined();
			expect(atLimit.answers.inventory).toEqual(staging);

			const atInventory = reducer(atLimit, {type: 'back'});
			expect(atInventory.prompt?.step).toBe('inventory');
			expect(atInventory.answers).toEqual({});
			expect(reducer(atInventory, {type: 'back'})).toBe(atInventory);
		});

		it('skips prompts that were answered automatically', () => {
			const state = run([
				{type: 'discovered', discovery: discovery({playbooks: [{file: 'site.yml'}]})},
				{type: 'chooseInventory', inventory: staging},
				{type: 'inventoryLoaded', contents},
				{type: 'chooseLimit', limit: []},
				{type: 'tagsLoaded', tags: []},
			]);
			expect(state.prompt?.step).toBe('mode');

			// The playbook and tags were never asked, so back goes to the limit prompt
			const back = reducer(state, {type: 'back'});
			expect(back.prompt?.step).toBe('limit');
			expect(back.answers.playbook).toBeUndefined();
		});
	});

	describe('replay', () => {
		const last = ['ansible-playbook', '-i', 'staging', '--check', '--diff', 'site.yml'];

		it('offers the last command and re-runs it in either mode', () => {
			const state = run([{type: 'discovered', discovery: discovery({history: [last]})}]);
			expect(state.prompt).toEqual({step: 'replay', last});

			const live = reducer(state, {type: 'chooseReplay', choice: 'live'});
			expect(live.prompt).toEqual({
				step: 'confirm',
				command: ['ansible-playbook', '-i', 'staging', '--diff', 'site.yml'],
			});

			expect(reducer(live, {type: 'back'}).prompt).toEqual({step: 'replay', last});
		});

		it('starts a new command and can go back to the replay prompt', () => {
			const state = run([
				{type: 'discovered', discovery: discovery({history: [last]})},
				{type: 'chooseReplay', choice: 'new'},
			]);
			expect(state.prompt?.step).toBe('inventory');
			expect(reducer(state, {type: 'back'}).prompt?.step).toBe('replay');
		});
	});
});
