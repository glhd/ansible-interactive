import {Text} from 'ink';
import type {Answers} from '../flow/state.js';
import {Answer} from './Answer.js';

/** The "✔ Label · value" lines for questions already answered */
export function Summary({answers}: {answers: Answers}) {
	const {inventory, limit, playbook, tagWarning, availableTags, tags, mode} = answers;

	return (
		<>
			{inventory && <Answer label="Inventory" value={inventory.label} />}
			{limit && <Answer label="Limit" value={limit.length > 0 ? limit.join(', ') : 'all hosts'} />}
			{playbook && <Answer label="Playbook" value={playbook.file} />}
			{tagWarning && <Text color="yellow">⚠ {tagWarning}</Text>}
			{tags && availableTags && availableTags.length > 0 && (
				<Answer label="Tags" value={tags.length > 0 ? tags.join(', ') : 'all tags'} />
			)}
			{mode && <Answer label="Mode" value={mode === 'live' ? 'live (applies changes)' : 'check'} />}
		</>
	);
}
