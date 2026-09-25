import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmod, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {BUILD_TARGET, REPOSITORY, VERSION} from './build-info.js';

const CHECK_INTERVAL = 24 * 60 * 60 * 1000;
const CHECK_TIMEOUT = 3000;

export type UpdateInfo = {current: string; latest: string};

type Cache = {checkedAt: number; latest: string};

/** Compare dotted versions. A pre-release sorts before its release. */
export function compareVersions(a: string, b: string): number {
	const parse = (version: string) => {
		const [core = '', pre] = version.replace(/^v/, '').split('-', 2);
		return {parts: core.split('.').map(part => Number.parseInt(part, 10) || 0), pre};
	};

	const left = parse(a);
	const right = parse(b);
	for (let i = 0; i < Math.max(left.parts.length, right.parts.length); i++) {
		const diff = (left.parts[i] ?? 0) - (right.parts[i] ?? 0);
		if (diff !== 0) {
			return Math.sign(diff);
		}
	}

	if (left.pre === right.pre) {
		return 0;
	}

	if (left.pre === undefined) {
		return 1;
	}

	if (right.pre === undefined) {
		return -1;
	}

	return left.pre.localeCompare(right.pre);
}

export function updateChecksDisabled(env = process.env): boolean {
	return Boolean(env.ANSIBLE_INTERACTIVE_DISABLE_UPDATE_CHECK || env.CI);
}

export function autoUpdateEnabled(env = process.env): boolean {
	return env.ANSIBLE_INTERACTIVE_AUTO_UPDATE === '1' && BUILD_TARGET !== undefined;
}

function cacheFile(env = process.env): string {
	const base = env.XDG_CACHE_HOME || path.join(homedir(), '.cache');
	return path.join(base, 'ansible-interactive', 'update-check.json');
}

/** Ask GitHub for the newest release's version (without the "v" prefix). */
export async function fetchLatestVersion(): Promise<string> {
	const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
		headers: {Accept: 'application/vnd.github+json', 'User-Agent': `ansible-interactive/${VERSION}`},
		signal: AbortSignal.timeout(CHECK_TIMEOUT),
	});

	if (!response.ok) {
		throw new Error(`GitHub responded with ${response.status}`);
	}

	const release = (await response.json()) as {tag_name?: string};
	if (!release.tag_name) {
		throw new Error('GitHub release has no tag');
	}

	return release.tag_name.replace(/^v/, '');
}

/**
 * Check for a newer release at most once a day. Never throws: update checks
 * must not get in the way of running playbooks.
 */
export async function checkForUpdate({force = false} = {}): Promise<UpdateInfo | undefined> {
	if (!force && updateChecksDisabled()) {
		return undefined;
	}

	const file = cacheFile();
	let latest: string | undefined;

	try {
		const cache = JSON.parse(await readFile(file, 'utf8')) as Cache;
		if (!force && Date.now() - cache.checkedAt < CHECK_INTERVAL) {
			latest = cache.latest;
		}
	} catch {
		// No cache yet
	}

	if (latest === undefined) {
		try {
			latest = await fetchLatestVersion();
			await mkdir(path.dirname(file), {recursive: true});
			await writeFile(file, JSON.stringify({checkedAt: Date.now(), latest} satisfies Cache));
		} catch {
			return undefined;
		}
	}

	return compareVersions(latest, VERSION) > 0 ? {current: VERSION, latest} : undefined;
}

/** How to update, depending on how this copy was installed. */
export function updateInstructions(): string {
	return BUILD_TARGET
		? 'ansible-interactive update'
		: `npm install --global github:${REPOSITORY}`;
}

export function formatUpdateNotice(update: UpdateInfo): string {
	return `Update available: ${update.current} → ${update.latest}. Run "${updateInstructions()}" to update.`;
}

/**
 * Replace the running standalone binary with a release from GitHub.
 * Downloads the tarball, checks it against SHA256SUMS.txt, then swaps the
 * file in with an atomic rename.
 */
export async function selfUpdate(version: string, log: (message: string) => void = () => {}): Promise<void> {
	if (!BUILD_TARGET) {
		throw new Error(
			`This copy runs on Node.js, so it can't update itself. Run "${updateInstructions()}" instead.`,
		);
	}

	const tag = `v${version.replace(/^v/, '')}`;
	const asset = `ansible-interactive-${BUILD_TARGET}.tar.gz`;
	// A mirror can stand in for GitHub (also used to test updates end to end)
	const releases = process.env.ANSIBLE_INTERACTIVE_RELEASES_URL ?? `https://github.com/${REPOSITORY}/releases`;
	const base = `${releases.replace(/\/$/, '')}/download/${tag}`;

	log(`Downloading ${asset} (${tag})…`);
	const [tarball, sums] = await Promise.all([download(`${base}/${asset}`), download(`${base}/SHA256SUMS.txt`)]);

	const expected = parseChecksums(sums.toString('utf8')).get(asset);
	if (!expected) {
		throw new Error(`SHA256SUMS.txt has no entry for ${asset}`);
	}

	const actual = createHash('sha256').update(tarball).digest('hex');
	if (actual !== expected) {
		throw new Error(`Checksum mismatch for ${asset}: expected ${expected}, got ${actual}`);
	}

	const target = await realpath(process.execPath);
	// Stage next to the binary so the final rename stays on one filesystem
	const staging = await mkdtemp(path.join(path.dirname(target), '.ansible-interactive-update-')).catch(
		(error: NodeJS.ErrnoException) => {
			throw error.code === 'EACCES' || error.code === 'EPERM'
				? new Error(`No permission to write to ${path.dirname(target)}. Try again with sudo.`)
				: error;
		},
	);

	try {
		const archive = path.join(staging, asset);
		await writeFile(archive, tarball);
		await promisify(execFile)('tar', ['-xzf', archive, '-C', staging]);

		const binary = path.join(staging, 'ansible-interactive');
		await chmod(binary, 0o755);
		await rename(binary, target);
	} finally {
		await rm(staging, {recursive: true, force: true});
	}

	log(`Updated ${target} to ${tag.slice(1)}`);
}

export function parseChecksums(contents: string): Map<string, string> {
	const sums = new Map<string, string>();
	for (const line of contents.split('\n')) {
		const match = /^([a-f\d]{64})\s+\*?(.+)$/i.exec(line.trim());
		if (match) {
			sums.set(match[2]!, match[1]!.toLowerCase());
		}
	}

	return sums;
}

async function download(url: string): Promise<Buffer> {
	const response = await fetch(url, {
		headers: {'User-Agent': `ansible-interactive/${VERSION}`},
		signal: AbortSignal.timeout(5 * 60 * 1000),
	});

	if (!response.ok) {
		throw new Error(`Download failed (${response.status}): ${url}`);
	}

	return Buffer.from(await response.arrayBuffer());
}
