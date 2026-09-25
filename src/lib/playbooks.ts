import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {parse as parseYaml} from 'yaml';

export type Playbook = {
	file: string;
	/** Name of the first play, if any */
	name?: string;
};

const PLAYBOOK_DIRS = ['.', 'playbooks'];
const IMPORT_KEYS = ['import_playbook', 'ansible.builtin.import_playbook'];

/** Find YAML files in cwd (and ./playbooks) that contain Ansible plays. */
export async function findPlaybooks(cwd = process.cwd()): Promise<Playbook[]> {
	const playbooks: Playbook[] = [];

	for (const directory of PLAYBOOK_DIRS) {
		let names: string[];
		try {
			names = await readdir(path.join(cwd, directory));
		} catch {
			continue;
		}

		for (const name of names.sort((a, b) => a.localeCompare(b))) {
			if (!/\.ya?ml$/i.test(name)) {
				continue;
			}

			const file = path.join(directory, name);
			const contents = await readFile(path.join(cwd, file), 'utf8').catch(() => undefined);
			const playbook = contents === undefined ? undefined : parsePlaybook(file, contents);
			if (playbook) {
				playbooks.push(playbook);
			}
		}
	}

	return playbooks;
}

export function parsePlaybook(file: string, contents: string): Playbook | undefined {
	let data: unknown;
	try {
		data = parseYaml(contents);
	} catch {
		return undefined;
	}

	if (!Array.isArray(data) || data.length === 0) {
		return undefined;
	}

	const isPlay = (item: unknown) =>
		typeof item === 'object' &&
		item !== null &&
		('hosts' in item || IMPORT_KEYS.some(key => key in item));

	if (!data.every(isPlay)) {
		return undefined;
	}

	const first = data[0] as {name?: unknown};
	return {file, name: typeof first.name === 'string' ? first.name : undefined};
}
