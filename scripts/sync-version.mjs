#!/usr/bin/env node
/**
 * Set package.json and package-lock.json to a release tag's version, unless
 * they already hold a newer one (e.g. when tagging a hotfix for an old release).
 *
 *   node scripts/sync-version.mjs v1.2.0
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

/** Compare two semver versions, following semver's pre-release rules. */
export function compareVersions(a, b) {
	const [, ...left] = SEMVER.exec(a) ?? [];
	const [, ...right] = SEMVER.exec(b) ?? [];
	if (left.length === 0 || right.length === 0) {
		throw new Error(`Not a semver version: ${left.length === 0 ? a : b}`);
	}

	for (let i = 0; i < 3; i++) {
		const diff = Number(left[i]) - Number(right[i]);
		if (diff !== 0) {
			return Math.sign(diff);
		}
	}

	const [preLeft, preRight] = [left[3], right[3]];
	if (preLeft === preRight) {
		return 0;
	}

	// A release sorts after its pre-releases
	if (preLeft === undefined) {
		return 1;
	}

	if (preRight === undefined) {
		return -1;
	}

	const partsLeft = preLeft.split('.');
	const partsRight = preRight.split('.');
	for (let i = 0; i < Math.max(partsLeft.length, partsRight.length); i++) {
		const [x, y] = [partsLeft[i], partsRight[i]];
		if (x === undefined) {
			return -1;
		}

		if (y === undefined) {
			return 1;
		}

		const [xNum, yNum] = [/^\d+$/.test(x), /^\d+$/.test(y)];
		if (xNum && yNum && Number(x) !== Number(y)) {
			return Math.sign(Number(x) - Number(y));
		}

		if (xNum !== yNum) {
			// Numeric identifiers sort before alphanumeric ones
			return xNum ? -1 : 1;
		}

		if (x !== y) {
			return x < y ? -1 : 1;
		}
	}

	return 0;
}

function main() {
	const version = process.argv[2]?.replace(/^v/, '');
	if (!version || !SEMVER.test(version)) {
		console.error('Usage: node scripts/sync-version.mjs <tag>, e.g. v1.2.0 or v1.2.0-beta.1');
		process.exit(1);
	}

	const current = JSON.parse(readFileSync('package.json', 'utf8')).version;
	if (compareVersions(version, current) <= 0) {
		console.log(`package.json is already at ${current}; leaving it as is.`);
		return;
	}

	execFileSync('npm', ['version', version, '--no-git-tag-version'], {stdio: 'inherit'});
	console.log(`Updated package.json from ${current} to ${version}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main();
}
