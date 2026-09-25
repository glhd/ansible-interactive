import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {findPlaybooks, parsePlaybook} from './playbooks.js';

describe('playbooks', () => {
	it('only accepts lists of plays', () => {
		expect(parsePlaybook('site.yml', '- name: Site\n  hosts: all\n')).toEqual({file: 'site.yml', name: 'Site'});
		expect(parsePlaybook('all.yml', '- ansible.builtin.import_playbook: site.yml\n')).toEqual({file: 'all.yml'});
		expect(parsePlaybook('req.yml', 'collections:\n  - community.general\n')).toBeUndefined();
		expect(parsePlaybook('tasks.yml', '- name: task\n  ansible.builtin.debug: msg=hi\n')).toBeUndefined();
		expect(parsePlaybook('bad.yml', '- [unclosed\n')).toBeUndefined();
	});

	it('looks in the current directory and ./playbooks', async () => {
		const cwd = await mkdtemp(path.join(tmpdir(), 'ai-playbooks-'));
		await mkdir(path.join(cwd, 'playbooks'));
		await writeFile(path.join(cwd, 'site.yml'), '- hosts: all\n');
		await writeFile(path.join(cwd, 'requirements.yml'), 'roles: []\n');
		await writeFile(path.join(cwd, 'playbooks/deploy.yaml'), '- hosts: web\n');

		const found = await findPlaybooks(cwd);
		expect(found.map(playbook => playbook.file)).toEqual(['site.yml', path.join('playbooks', 'deploy.yaml')]);
	});
});
