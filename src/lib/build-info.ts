import {readFileSync} from 'node:fs';

// Replaced at build time by scripts/build-binaries.ts
declare const __VERSION__: string | undefined;
declare const __BUILD_TARGET__: string | undefined;

/** Platform of the standalone binary (e.g. "darwin-arm64"), or undefined when run with Node. */
export const BUILD_TARGET: string | undefined =
	typeof __BUILD_TARGET__ === 'string' ? __BUILD_TARGET__ : undefined;

export const VERSION: string =
	typeof __VERSION__ === 'string'
		? __VERSION__
		: (
				JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
					version: string;
				}
			).version;

export const REPOSITORY = 'glhd/ansible-interactive';
