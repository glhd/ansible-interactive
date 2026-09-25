import {readdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {parse as parseYaml} from 'yaml';
import {run} from './exec.js';

export type InventoryCandidate = {
	/** Sources to pass with -i. Empty means "use Ansible's configured default". */
	sources: string[];
	label: string;
	hint?: string;
};

export type InventoryGroup = {name: string; hostCount: number};

export type InventoryContents = {
	groups: InventoryGroup[];
	hosts: string[];
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Ask Ansible for its configured default inventory (from ansible.cfg or
 * ANSIBLE_INVENTORY). Returns undefined when it's still the built-in default.
 */
export async function configuredInventory(cwd = process.cwd()): Promise<InventoryCandidate | undefined> {
	type Setting = {name?: string; origin?: string; value?: unknown};

	let settings: Setting[];
	try {
		const {stdout} = await run('ansible-config', ['dump', '--only-changed', '--format', 'json'], cwd);
		settings = JSON.parse(stdout) as Setting[];
	} catch {
		return undefined;
	}

	const setting = settings.find(s => s.name === 'DEFAULT_HOST_LIST');
	if (!setting || !Array.isArray(setting.value) || setting.value.length === 0) {
		return undefined;
	}

	const paths = (setting.value as string[]).map(p => relative(cwd, p));
	const origin = setting.origin?.startsWith('env:') ? 'ANSIBLE_INVENTORY' : 'ansible.cfg';

	return {sources: [], label: paths.join(', '), hint: `default from ${origin}`};
}

/** Find files and directories in cwd that look like Ansible inventories. */
export async function findInventories(cwd = process.cwd()): Promise<InventoryCandidate[]> {
	const candidates: InventoryCandidate[] = [];

	for (const name of await list(cwd)) {
		const full = path.join(cwd, name);
		const info = await stat(full).catch(() => undefined);
		if (!info) {
			continue;
		}

		if (info.isDirectory()) {
			if (name === 'inventory') {
				candidates.push({sources: [name], label: name, hint: 'directory'});
			} else if (name === 'inventories') {
				for (const child of await list(full)) {
					const childPath = path.join(name, child);
					const childInfo = await stat(path.join(cwd, childPath)).catch(() => undefined);
					if (childInfo?.isDirectory()) {
						candidates.push({sources: [childPath], label: childPath, hint: 'directory'});
					} else if (childInfo?.isFile() && (await looksLikeInventoryFile(path.join(cwd, childPath)))) {
						candidates.push({sources: [childPath], label: childPath});
					}
				}
			}

			continue;
		}

		if (info.isFile() && info.size <= MAX_FILE_SIZE && (await looksLikeInventoryFile(full))) {
			candidates.push({sources: [name], label: name});
		}
	}

	return candidates;
}

export async function looksLikeInventoryFile(file: string): Promise<boolean> {
	const name = path.basename(file);
	const extension = path.extname(name).toLowerCase();

	if (name.startsWith('.') || name === 'ansible.cfg') {
		return false;
	}

	let contents: string;
	try {
		contents = await readFile(file, 'utf8');
	} catch {
		return false;
	}

	if (extension === '.yml' || extension === '.yaml') {
		return looksLikeYamlInventory(contents);
	}

	if (extension === '' || extension === '.ini') {
		return looksLikeIniInventory(name, contents);
	}

	return false;
}

export function looksLikeIniInventory(name: string, contents: string): boolean {
	if (contents.includes('\0')) {
		return false;
	}

	// A group header like [web] or [web:children]
	if (/^\s*\[[^\]\s]+\]\s*$/m.test(contents)) {
		return true;
	}

	// Section-less files are only inventories if they're named like one
	return /^(hosts|inventory)$/i.test(name);
}

export function looksLikeYamlInventory(contents: string): boolean {
	let data: unknown;
	try {
		data = parseYaml(contents);
	} catch {
		return false;
	}

	if (!isRecord(data)) {
		return false;
	}

	// Inventory plugin config, e.g. aws_ec2.yml or *.community.general.proxmox.yml
	if (typeof data.plugin === 'string') {
		return true;
	}

	const groups = Object.values(data);
	return (
		groups.length > 0 &&
		groups.every(group => group === null || isRecord(group)) &&
		groups.some(
			group => isRecord(group) && ('hosts' in group || 'children' in group || 'vars' in group),
		)
	);
}

/** Load the groups and hosts in an inventory using ansible-inventory. */
export async function loadInventory(
	sources: string[],
	cwd = process.cwd(),
): Promise<InventoryContents> {
	const args = sources.flatMap(source => ['-i', source]);
	const {stdout} = await run('ansible-inventory', [...args, '--list'], cwd);
	const contents = parseInventoryList(JSON.parse(stdout) as Record<string, unknown>);

	if (contents.hosts.length === 0) {
		const label = sources.length > 0 ? sources.join(', ') : 'the default inventory';
		throw new Error(`No hosts found in ${label}`);
	}

	return contents;
}

type InventoryGroupEntry = {hosts?: string[]; children?: string[]};

/** Parse the JSON printed by `ansible-inventory --list`. */
export function parseInventoryList(list: Record<string, unknown>): InventoryContents {
	const groupNames = Object.keys(list).filter(name => name !== '_meta' && name !== 'all');
	const meta = list._meta as {hostvars?: Record<string, unknown>} | undefined;

	const hostsIn = (name: string, seen = new Set<string>()): Set<string> => {
		if (seen.has(name)) {
			return new Set();
		}

		seen.add(name);
		const group = list[name] as InventoryGroupEntry | undefined;
		const hosts = new Set(group?.hosts ?? []);
		for (const child of group?.children ?? []) {
			for (const host of hostsIn(child, seen)) {
				hosts.add(host);
			}
		}

		return hosts;
	};

	const groups = groupNames
		.map(name => ({name, hostCount: hostsIn(name).size}))
		.filter(group => group.hostCount > 0)
		.sort((a, b) => a.name.localeCompare(b.name));

	const hosts = new Set(Object.keys(meta?.hostvars ?? {}));
	for (const host of hostsIn('all')) {
		hosts.add(host);
	}

	for (const name of groupNames) {
		for (const host of hostsIn(name)) {
			hosts.add(host);
		}
	}

	return {groups, hosts: [...hosts].sort((a, b) => a.localeCompare(b))};
}

async function list(directory: string): Promise<string[]> {
	try {
		return (await readdir(directory)).sort((a, b) => a.localeCompare(b));
	} catch {
		return [];
	}
}

function relative(cwd: string, file: string): string {
	const rel = path.relative(cwd, file);
	return rel && !rel.startsWith('..') ? rel : file;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
