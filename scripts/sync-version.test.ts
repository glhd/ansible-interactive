import {describe, expect, it} from 'vitest';
// @ts-expect-error Plain JS script without type declarations
import {compareVersions} from './sync-version.mjs';

describe('compareVersions', () => {
	it('follows semver ordering', () => {
		const ordered = [
			'1.0.0-alpha',
			'1.0.0-alpha.1',
			'1.0.0-alpha.beta',
			'1.0.0-beta',
			'1.0.0-beta.2',
			'1.0.0-beta.11',
			'1.0.0-rc.1',
			'1.0.0',
			'1.0.1',
			'1.10.0',
			'2.0.0-beta.1',
			'2.0.0',
		];

		for (let i = 0; i < ordered.length - 1; i++) {
			expect(compareVersions(ordered[i], ordered[i + 1])).toBe(-1);
			expect(compareVersions(ordered[i + 1], ordered[i])).toBe(1);
		}

		expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
		expect(() => compareVersions('1.2', '1.2.3')).toThrow(/Not a semver/);
	});
});
