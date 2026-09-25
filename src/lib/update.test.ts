import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {VERSION} from './build-info.js';
import {checkForUpdate, compareVersions, parseChecksums, updateChecksDisabled} from './update.js';

describe('compareVersions', () => {
	it('orders versions', () => {
		expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
		expect(compareVersions('v2.0.0', '1.9.9')).toBe(1);
		expect(compareVersions('1.0', '1.0.0')).toBe(0);
		expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
		expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
	});
});

describe('parseChecksums', () => {
	it('reads sha256sum output', () => {
		const hash = 'a'.repeat(64);
		const sums = parseChecksums(`${hash}  ansible-interactive-linux-x64.tar.gz\n${'b'.repeat(64)} *other\n`);
		expect(sums.get('ansible-interactive-linux-x64.tar.gz')).toBe(hash);
		expect(sums.get('other')).toBe('b'.repeat(64));
	});
});

describe('checkForUpdate', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it('is off in CI or when disabled', () => {
		expect(updateChecksDisabled({CI: 'true'})).toBe(true);
		expect(updateChecksDisabled({ANSIBLE_INTERACTIVE_DISABLE_UPDATE_CHECK: '1'})).toBe(true);
		expect(updateChecksDisabled({})).toBe(false);
	});

	it('reports a newer release and caches the answer for a day', async () => {
		vi.stubEnv('CI', '');
		vi.stubEnv('ANSIBLE_INTERACTIVE_DISABLE_UPDATE_CHECK', '');
		vi.stubEnv('XDG_CACHE_HOME', await mkdtemp(path.join(tmpdir(), 'ai-cache-')));
		const fetch = vi.fn(async () => Response.json({tag_name: 'v999.0.0'}));
		vi.stubGlobal('fetch', fetch);

		expect(await checkForUpdate()).toEqual({current: VERSION, latest: '999.0.0'});
		expect(await checkForUpdate()).toEqual({current: VERSION, latest: '999.0.0'});
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('stays quiet when offline', async () => {
		vi.stubEnv('CI', '');
		vi.stubEnv('XDG_CACHE_HOME', await mkdtemp(path.join(tmpdir(), 'ai-cache-')));
		vi.stubGlobal('fetch', vi.fn(async () => {
			throw new Error('offline');
		}));

		expect(await checkForUpdate()).toBeUndefined();
	});
});
