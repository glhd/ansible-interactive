#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {render} from 'ink';
import {App} from './app.js';
import {saveHistory} from './lib/history.js';
import {runAttached} from './lib/run.js';

const HELP = `
Usage: ansible-interactive [options] [-- ansible-playbook args]

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
`;

function version(): string {
	const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
		version: string;
	};
	return pkg.version;
}

async function main(): Promise<number> {
	// Everything after "--" belongs to ansible-playbook
	const args = process.argv.slice(2);
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
		console.log(version());
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
		process.exitCode = code;
	},
	(error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		if ((error as NodeJS.ErrnoException).code?.startsWith('ERR_PARSE_ARGS')) {
			console.error('Run "ansible-interactive --help" for usage.');
		}

		process.exitCode = 1;
	},
);
