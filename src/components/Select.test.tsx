import {render} from 'ink-testing-library';
import {describe, expect, it, vi} from 'vitest';
import {Select} from './Select.js';

const options = ['alpha', 'beta', 'gamma'].map(label => ({label, value: label}));
const tick = () => new Promise(resolve => setTimeout(resolve, 20));

describe('Select', () => {
	it('picks the highlighted option', async () => {
		const onSubmit = vi.fn();
		const {stdin} = render(<Select options={options} onSubmit={onSubmit} />);
		await tick();
		stdin.write('\u001B[B'); // down
		await tick();
		stdin.write('\r');
		await tick();
		expect(onSubmit).toHaveBeenCalledWith(['beta']);
	});

	it('filters by typing', async () => {
		const onSubmit = vi.fn();
		const {stdin, lastFrame} = render(<Select options={options} onSubmit={onSubmit} />);
		await tick();
		stdin.write('gam');
		await tick();
		expect(lastFrame()).toContain('Filter: gam');
		expect(lastFrame()).not.toContain('alpha');
		stdin.write('\r');
		await tick();
		expect(onSubmit).toHaveBeenCalledWith(['gamma']);
	});

	it('toggles several options in multi mode', async () => {
		const onSubmit = vi.fn();
		const {stdin, lastFrame} = render(<Select multiple options={options} onSubmit={onSubmit} />);
		await tick();
		stdin.write(' ');
		await tick();
		stdin.write('\u001B[B');
		await tick();
		stdin.write('\u001B[B');
		await tick();
		stdin.write(' ');
		await tick();
		expect(lastFrame()).toContain('2 selected');
		stdin.write('\r');
		await tick();
		expect(onSubmit).toHaveBeenCalledWith(['alpha', 'gamma']);
	});

	it('submits nothing in multi mode when nothing is selected', async () => {
		const onSubmit = vi.fn();
		const {stdin, lastFrame} = render(
			<Select multiple options={options} noneSelectedHint="all hosts" onSubmit={onSubmit} />,
		);
		await tick();
		expect(lastFrame()).toContain('all hosts');
		stdin.write('\r');
		await tick();
		expect(onSubmit).toHaveBeenCalledWith([]);
	});

	it('goes back on escape', async () => {
		const onBack = vi.fn();
		const {stdin} = render(<Select options={options} onSubmit={() => {}} onBack={onBack} />);
		await tick();
		stdin.write('\u001B');
		await tick();
		await tick();
		expect(onBack).toHaveBeenCalled();
	});
});
