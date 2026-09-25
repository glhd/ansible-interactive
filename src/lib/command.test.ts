import {describe, expect, it} from 'vitest';
import {buildCommand, formatCommand, isCheckMode, shellQuote, withMode} from './command.js';

describe('buildCommand', () => {
	it('builds a check-mode command with tags and limit', () => {
		expect(
			buildCommand({
				inventory: ['staging'],
				playbook: 'site.yml',
				limit: ['web', 'db1'],
				tags: ['deploy', 'nginx'],
				mode: 'check',
				extra: ['-K'],
			}),
		).toEqual([
			'ansible-playbook',
			'-i',
			'staging',
			'--check',
			'--diff',
			'--tags',
			'deploy,nginx',
			'--limit',
			'web,db1',
			'-K',
			'site.yml',
		]);
	});

	it('omits -i when using the configured default inventory', () => {
		expect(
			buildCommand({inventory: [], playbook: 'site.yml', limit: [], tags: [], mode: 'live', extra: []}),
		).toEqual(['ansible-playbook', '--diff', 'site.yml']);
	});
});

describe('withMode', () => {
	const live = ['ansible-playbook', '-i', 'hosts', '--diff', 'site.yml'];

	it('switches between check and live mode', () => {
		const check = withMode(live, 'check');
		expect(isCheckMode(check)).toBe(true);
		expect(withMode(check, 'live')).toEqual(live);
		expect(withMode(['ansible-playbook', '-C', 'site.yml'], 'live')).toEqual(['ansible-playbook', 'site.yml']);
	});
});

describe('shellQuote', () => {
	it('only quotes when needed', () => {
		expect(shellQuote('--tags=a,b')).toBe('--tags=a,b');
		expect(shellQuote('web:&db')).toBe(`'web:&db'`);
		expect(shellQuote("it's")).toBe(`'it'\\''s'`);
		expect(shellQuote('')).toBe(`''`);
		expect(formatCommand(['ansible-playbook', '-e', 'a=1 b=2'])).toBe(`ansible-playbook -e 'a=1 b=2'`);
	});
});
