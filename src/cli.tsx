#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {render} from 'ink';
import {App} from './app.js';
import {VERSION} from './lib/build-info.js';
import {saveHistory} from './lib/history.js';
import {runAttached} from './lib/run.js';
import {
	autoUpdateEnabled,
	checkForUpdate,
	compareVersions,
	fetchLatestVersion,
	formatUpdateNotice,
	selfUpdate,
} from './lib/update.js';

const HELP = `
Usage: ansible-interactive [options] [-- ansible-playbook args]
       ansible-interactive update [version]

Build and run an ansible-playbook command by answering a few questions.

Options
  -i, --inventory <path>  Inventory source to use (repeatable)
  -p, --playbook <path>   Playbook to run
      --no-history        Don't read or write .ansible-interactive-history
      --delay <seconds>   Pause before a live run starts (default: 3)
  -v, --verbose           Show stack traces on errors
  -h, --help              Show this help
      --version           Show the version

Anything after "--" is passed to ansible-playbook as-is, for example:
  ansible-interactive -- --ask-become-pass -e env=staging

Updates
  ansible-interactive checks GitHub for a new release once a day and tells
  you when one is out. "ansible-interactive update" installs it.
  ANSIBLE_INTERACTIVE_AUTO_UPDATE=1          install updates after each run
  ANSIBLE_INTERACTIVE_DISABLE_UPDATE_CHECK=1 never check for updates
`;

async function update(version?: string): Promise<number> {
	const target = version ?? (await fetchLatestVersion());
	if (version === undefined && compareVersions(target, VERSION) <= 0) {
		console.log(`ansible-interactive is up to date (${VERSION}).`);
		return 0;
	}

	await selfUpdate(target, message => console.log(message));
	return 0;
}

/** Tell the user about a new release, or install it if they opted in. */
async function afterRun(check: ReturnType<typeof checkForUpdate>): Promise<void> {
	// Don't hold up the exit for a slow network
	const available = await Promise.race([
		check,
		new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 1000).unref()),
	]);
	if (!available) {
		return;
	}

	if (autoUpdateEnabled()) {
		try {
			await selfUpdate(available.latest, message => console.error(message));
			return;
		} catch (error) {
			console.error(`Auto-update failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	console.error(`\n\u001B[33m${formatUpdateNotice(available)}\u001B[39m`);
}

async function main(): Promise<number> {
	const args = process.argv.slice(2);

	if (args[0] === 'update') {
		if (args.length > 2) {
			throw new Error('Usage: ansible-interactive update [version]');
		}

		return update(args[1]);
	}

	// Everything after "--" belongs to ansible-playbook
	const separator = args.indexOf('--');
	const extra = separator === -1 ? [] : args.slice(separator + 1);

	const {values} = parseArgs({
		args: separator === -1 ? args : args.slice(0, separator),
		options: {
			inventory: {type: 'string', short: 'i', multiple: true},
			playbook: {type: 'string', short: 'p'},
			'no-history': {type: 'boolean'},
			delay: {type: 'string'},
			verbose: {type: 'boolean', short: 'v'},
			help: {type: 'boolean', short: 'h'},
			version: {type: 'boolean'},
		},
	});

	if (values.help) {
		console.log(HELP.trim());
		return 0;
	}

	if (values.version) {
		console.log(VERSION);
		return 0;
	}

	if (!process.stdin.isTTY) {
		console.error('ansible-interactive needs an interactive terminal.');
		return 1;
	}

	const delay = values.delay === undefined ? 3 : Number(values.delay);
	if (!Number.isInteger(delay) || delay < 0) {
		console.error('--delay must be a whole number of seconds.');
		return 1;
	}

	const updateCheck = checkForUpdate();
	const code = await interactive(values, extra, delay);
	await afterRun(updateCheck);
	return code;
}

type Values = {
	inventory?: string[];
	playbook?: string;
	'no-history'?: boolean;
	verbose?: boolean;
};

async function interactive(values: Values, extra: string[], delay: number): Promise<number> {
	const history = !values['no-history'];
	let command: string[] | undefined;

	const app = render(
		<App
			options={{
				cwd: process.cwd(),
				inventory: values.inventory ?? [],
				playbook: values.playbook,
				extra,
				history,
				delay,
			}}
			onDone={argv => {
				command = argv;
			}}
		/>,
	);

	try {
		await app.waitUntilExit();
	} catch (error) {
		// The app already showed the message
		if (values.verbose) {
			console.error(error);
		}

		return 1;
	}

	if (!command) {
		// Cancelled with ctrl+c
		return 130;
	}

	console.log();

	if (history) {
		await saveHistory(command).catch((error: unknown) => {
			console.error(`Could not save history: ${String(error)}`);
		});
	}

	return runAttached(command);
}

main().then(
	code => {
		// Exit now rather than wait on an unfinished update check
		process.exit(code);
	},
	(error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		if ((error as NodeJS.ErrnoException).code?.startsWith('ERR_PARSE_ARGS')) {
			console.error('Run "ansible-interactive --help" for usage.');
		}

		process.exitCode = 1;
	},
);
