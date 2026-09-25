import {describe, expect, it} from 'vitest';
import {parseListTags} from './tags.js';

describe('parseListTags', () => {
	it('collects play and task tags', () => {
		const output = [
			'',
			'playbook: site.yml',
			'',
			'  play #1 (all): all\tTAGS: [setup]',
			'      TASK TAGS: [deploy, nginx, setup]',
			'',
			'  play #2 (db): db\tTAGS: []',
			'      TASK TAGS: [postgres]',
		].join('\n');

		expect(parseListTags(output)).toEqual(['deploy', 'nginx', 'postgres', 'setup']);
	});
});
