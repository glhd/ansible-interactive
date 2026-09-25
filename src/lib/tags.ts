import {run} from './exec.js';

/** List every tag a playbook uses, via `ansible-playbook --list-tags`. */
export async function loadTags(
	inventory: string[],
	playbook: string,
	cwd = process.cwd(),
): Promise<string[]> {
	const args = [...inventory.flatMap(source => ['-i', source]), '--list-tags', playbook];
	const {stdout} = await run('ansible-playbook', args, cwd);
	return parseListTags(stdout);
}

/**
 * Parse `--list-tags` output, e.g.
 *   play #1 (all): all	TAGS: [setup]
 *       TASK TAGS: [deploy, nginx, setup]
 */
export function parseListTags(output: string): string[] {
	const tags = new Set<string>();

	for (const match of output.matchAll(/TAGS: \[([^\]]*)\]/g)) {
		for (const tag of (match[1] ?? '').split(',')) {
			const trimmed = tag.trim();
			if (trimmed) {
				tags.add(trimmed);
			}
		}
	}

	return [...tags].sort((a, b) => a.localeCompare(b));
}
