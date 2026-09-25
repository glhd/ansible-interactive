import {spawn} from 'node:child_process';
import {AnsibleNotFoundError} from './exec.js';

/**
 * Run a command attached to the terminal and resolve with its exit code.
 * No shell is involved, so arguments are passed through exactly.
 */
export function runAttached(argv: string[]): Promise<number> {
	const [binary, ...args] = argv;
	if (!binary) {
		return Promise.reject(new Error('Nothing to run'));
	}

	return new Promise((resolve, reject) => {
		const child = spawn(binary, args, {stdio: 'inherit'});

		// Ctrl+C reaches the child directly via the terminal's process group.
		// Stay alive so we can report how it exited.
		const ignore = () => {};
		const forward = (signal: NodeJS.Signals) => () => child.kill(signal);
		const onTerm = forward('SIGTERM');
		const onHup = forward('SIGHUP');

		process.on('SIGINT', ignore);
		process.on('SIGTERM', onTerm);
		process.on('SIGHUP', onHup);

		const cleanup = () => {
			process.off('SIGINT', ignore);
			process.off('SIGTERM', onTerm);
			process.off('SIGHUP', onHup);
		};

		child.on('error', error => {
			cleanup();
			reject(
				(error as NodeJS.ErrnoException).code === 'ENOENT' ? new AnsibleNotFoundError(binary) : error,
			);
		});

		child.on('exit', (code, signal) => {
			cleanup();
			resolve(code ?? (signal === 'SIGINT' ? 130 : 1));
		});
	});
}
