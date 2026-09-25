import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {findInventories, looksLikeIniInventory, looksLikeYamlInventory, parseInventoryList} from './inventory.js';

describe('inventory detection', () => {
	it('recognises INI inventories', () => {
		expect(looksLikeIniInventory('staging', '[web]\nweb1\n')).toBe(true);
		expect(looksLikeIniInventory('staging', '[web:children]\napp\n')).toBe(true);
		expect(looksLikeIniInventory('hosts', 'web1\nweb2\n')).toBe(true);
		expect(looksLikeIniInventory('LICENSE', 'MIT License\n')).toBe(false);
	});

	it('recognises YAML inventories and inventory plugin configs', () => {
		expect(looksLikeYamlInventory('all:\n  hosts:\n    web1:\n')).toBe(true);
		expect(looksLikeYamlInventory('web:\n  hosts:\n    web1:\ndb:\n  children:\n    x:\n')).toBe(true);
		expect(looksLikeYamlInventory('plugin: amazon.aws.aws_ec2\nregions: [us-east-1]\n')).toBe(true);
		expect(looksLikeYamlInventory('- hosts: all\n  tasks: []\n')).toBe(false);
		expect(looksLikeYamlInventory('collections:\n  - community.general\n')).toBe(false);
		expect(looksLikeYamlInventory('foo: bar\n')).toBe(false);
	});

	it('finds inventory files and directories', async () => {
		const cwd = await mkdtemp(path.join(tmpdir(), 'ai-inventory-'));
		await mkdir(path.join(cwd, 'inventories/production'), {recursive: true});
		await writeFile(path.join(cwd, 'inventories/staging.yml'), 'all:\n  hosts:\n    s1:\n');
		await writeFile(path.join(cwd, 'hosts'), 'web1\n');
		await writeFile(path.join(cwd, 'site.yml'), '- hosts: all\n');
		await writeFile(path.join(cwd, 'README'), '# readme\n');

		const found = await findInventories(cwd);
		expect(found.map(candidate => candidate.sources)).toEqual([
			['hosts'],
			[path.join('inventories', 'production')],
			[path.join('inventories', 'staging.yml')],
		]);
	});
});

describe('parseInventoryList', () => {
	it('collects groups with nested host counts and all hosts', () => {
		const contents = parseInventoryList({
			_meta: {hostvars: {app1: {}, db1: {}, web1: {}, web2: {}}},
			all: {children: ['ungrouped', 'web', 'db', 'workers']},
			ungrouped: {},
			web: {hosts: ['web1', 'web2']},
			db: {hosts: ['db1']},
			app: {hosts: ['app1']},
			workers: {children: ['app', 'web']},
			empty: {},
		});

		expect(contents.groups).toEqual([
			{name: 'app', hostCount: 1},
			{name: 'db', hostCount: 1},
			{name: 'web', hostCount: 2},
			{name: 'workers', hostCount: 3},
		]);
		expect(contents.hosts).toEqual(['app1', 'db1', 'web1', 'web2']);
	});
});
