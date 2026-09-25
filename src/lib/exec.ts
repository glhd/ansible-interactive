import {execFile} from 'node:child_process';

export class AnsibleNotFoundError extends Error {
	constructor(binary: string) {
		super(
			`Could not find "${binary}" on your PATH. Install Ansible first, e.g. "pipx install --include-deps ansible".`,
		);
	}
}

export type ExecResult = {stdout: string; stderr: string};

/**
 * Run an Ansible CLI tool and capture its output. Rejects with the tool's
 * stderr when it exits non-zero.
 */
export function run(binary: string, args: string[], cwd = process.cwd()): Promise<ExecResult> {
	return new Promise((resolve, reject) => {
		execFile(
			binary,
			args,
			{
				cwd,
				maxBuffer: 256 * 1024 * 1024,
				// Keep output machine-readable
				env: {...process.env, ANSIBLE_NOCOLOR: '1', ANSIBLE_FORCE_COLOR: '0'},
			},
			(error, stdout, stderr) => {
				if (error) {
					if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
						reject(new AnsibleNotFoundError(binary));
						return;
					}

					const message = stderr.trim() || stdout.trim() || error.message;
					reject(new Error(`${binary} failed:\n${message}`));
					return;
				}

				resolve({stdout, stderr});
			},
		);
	});
}
