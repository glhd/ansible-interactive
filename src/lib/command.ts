export type Mode = 'check' | 'live';

export type CommandOptions = {
	/** Inventory sources. Empty means "use the ansible.cfg / ANSIBLE_INVENTORY default". */
	inventory: string[];
	playbook: string;
	/** Hosts, groups or patterns to pass to --limit. Empty means all hosts. */
	limit: string[];
	/** Tags to pass to --tags. Empty means all tags. */
	tags: string[];
	mode: Mode;
	/** Extra arguments passed through to ansible-playbook verbatim. */
	extra: string[];
};

export function buildCommand(options: CommandOptions): string[] {
	const argv = ['ansible-playbook'];

	for (const source of options.inventory) {
		argv.push('-i', source);
	}

	if (options.mode === 'check') {
		argv.push('--check');
	}

	argv.push('--diff');

	if (options.tags.length > 0) {
		argv.push('--tags', options.tags.join(','));
	}

	if (options.limit.length > 0) {
		argv.push('--limit', options.limit.join(','));
	}

	argv.push(...options.extra, options.playbook);

	return argv;
}

export function isCheckMode(argv: string[]): boolean {
	return argv.includes('--check') || argv.includes('-C');
}

export function withMode(argv: string[], mode: Mode): string[] {
	const withoutCheck = argv.filter(arg => arg !== '--check' && arg !== '-C');
	if (mode === 'live') {
		return withoutCheck;
	}

	// Put --check right after the binary so it's easy to spot
	const [binary = 'ansible-playbook', ...rest] = withoutCheck;
	return [binary, '--check', ...rest];
}

/** Quote a single argument for display / copy-paste into a POSIX shell. */
export function shellQuote(arg: string): string {
	if (arg !== '' && /^[\w@%+=:,./-]+$/.test(arg)) {
		return arg;
	}

	return `'${arg.replaceAll("'", `'\\''`)}'`;
}

export function formatCommand(argv: string[]): string {
	return argv.map(shellQuote).join(' ');
}
