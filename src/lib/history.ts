import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const MAX_ENTRIES = 100;

export function historyFile(cwd = process.cwd()): string {
	return path.join(cwd, '.ansible-interactive-history');
}

/**
 * Versions before 1.0 ran commands through a shell and stored arguments like
 * `--tags='a,b'`. Commands now run without a shell, so strip those quotes.
 */
export function migrateEntry(entry: unknown): string[] | undefined {
	if (!Array.isArray(entry) || entry.length === 0 || !entry.every(arg => typeof arg === 'string')) {
		return undefined;
	}

	return entry.map((arg: string) => arg.replace(/^(--[\w-]+)='(.*)'$/, '$1=$2'));
}

export async function loadHistory(cwd?: string): Promise<string[][]> {
	try {
		const data: unknown = JSON.parse(await readFile(historyFile(cwd), 'utf8'));
		if (!Array.isArray(data)) {
			return [];
		}

		return data.map(migrateEntry).filter((entry): entry is string[] => entry !== undefined);
	} catch {
		return [];
	}
}

export async function saveHistory(argv: string[], cwd?: string): Promise<void> {
	const history = await loadHistory(cwd);
	const next = [argv, ...history].slice(0, MAX_ENTRIES);
	await writeFile(historyFile(cwd), JSON.stringify(next, null, '\t') + '\n', 'utf8');
}
