import {SelectPrompt} from '../components/SelectPrompt.js';

type Props = {
	tags: string[];
	onSubmit: (tags: string[]) => void;
	onBack?: () => void;
};

export function TagsStep({tags, onSubmit, onBack}: Props) {
	return (
		<SelectPrompt
			multiple
			question="Which tags would you like to run?"
			options={tags.map(tag => ({label: tag, value: tag}))}
			noneSelectedHint="Nothing selected: all tags"
			onSubmit={onSubmit}
			onBack={onBack}
		/>
	);
}
