/**
 * Build standalone binaries with `bun build --compile`.
 *
 *   bun scripts/build-binaries.ts            # every target
 *   bun scripts/build-binaries.ts linux-x64  # selected targets
 */
import {mkdir} from 'node:fs/promises';
import pkg from '../package.json' with {type: 'json'};

export const TARGETS = [
	'linux-x64',
	'linux-arm64',
	'linux-x64-musl',
	'linux-arm64-musl',
	'darwin-arm64',
] as const;

const requested = process.argv.slice(2);
const targets = requested.length > 0 ? requested : TARGETS;

for (const target of targets) {
	if (!(TARGETS as readonly string[]).includes(target)) {
		throw new Error(`Unknown target "${target}". Use one of: ${TARGETS.join(', ')}`);
	}
}

await mkdir('build', {recursive: true});

for (const target of targets) {
	const outfile = `build/ansible-interactive-${target}`;
	const result = await Bun.build({
		entrypoints: ['src/cli.tsx'],
		minify: true,
		define: {
			__VERSION__: JSON.stringify(pkg.version),
			__BUILD_TARGET__: JSON.stringify(target),
			'process.env.NODE_ENV': JSON.stringify('production'),
		},
		plugins: [
			{
				// Ink only loads React DevTools when DEV=true; leave it out of the binary
				name: 'stub-devtools',
				setup(build) {
					build.onResolve({filter: /^react-devtools-core$/}, () => ({
						path: 'react-devtools-core',
						namespace: 'stub',
					}));
					build.onLoad({filter: /.*/, namespace: 'stub'}, () => ({
						contents: 'export default {connectToDevTools() {}};',
						loader: 'js',
					}));
				},
			},
		],
		compile: {target: `bun-${target}`, outfile},
	});

	if (!result.success) {
		console.error(result.logs.join('\n'));
		process.exit(1);
	}

	console.log(`Built ${outfile}`);
}
