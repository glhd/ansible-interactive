import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {historyFile, loadHistory, migrateEntry, saveHistory} from './history.js';

describe('history', () => {
	it('strips shell quotes from pre-1.0 entries', () => {
		expect(migrateEntry(['ansible-playbook', "--tags='a,b'", "--limit='web'", 'site.yml'])).toEqual([
			'ansible-playbook',
			'--tags=a,b',
			'--limit=web',
			'site.yml',
		]);
		expect(migrateEntry('nope')).toBeUndefined();
		expect(migrateEntry([1, 2])).toBeUndefined();
	});

	it('saves newest first and survives a corrupt file', async () => {
		const cwd = await mkdtemp(path.join(tmpdir(), 'ai-history-'));
		expect(await loadHistory(cwd)).toEqual([]);

		await writeFile(historyFile(cwd), '{not json');
		expect(await loadHistory(cwd)).toEqual([]);

		await saveHistory(['ansible-playbook', 'a.yml'], cwd);
		await saveHistory(['ansible-playbook', 'b.yml'], cwd);
		expect(await loadHistory(cwd)).toEqual([
			['ansible-playbook', 'b.yml'],
			['ansible-playbook', 'a.yml'],
		]);
		expect(JSON.parse(await readFile(historyFile(cwd), 'utf8'))).toHaveLength(2);
	});
});
