import {Box, Text, useInput} from 'ink';
import {useMemo, useState} from 'react';

export type Option<T> = {
	label: string;
	value: T;
	hint?: string;
	color?: string;
};

type Props<T> = {
	options: Option<T>[];
	/** Allow picking several options with space */
	multiple?: boolean;
	/** Multi-select only: what submitting with nothing selected means */
	noneSelectedHint?: string;
	visibleCount?: number;
	onSubmit: (values: T[]) => void;
	onBack?: () => void;
};

export function Select<T>({
	options,
	multiple = false,
	noneSelectedHint,
	visibleCount = 10,
	onSubmit,
	onBack,
}: Props<T>) {
	const [filter, setFilter] = useState('');
	const [cursor, setCursor] = useState(0);
	const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());

	// Indices into `options` that match the filter
	const visible = useMemo(() => {
		const needle = filter.toLowerCase();
		return options
			.map((option, index) => ({option, index}))
			.filter(({option}) => option.label.toLowerCase().includes(needle))
			.map(({index}) => index);
	}, [options, filter]);

	const move = (delta: number) => {
		if (visible.length > 0) {
			setCursor(current => (current + delta + visible.length) % visible.length);
		}
	};

	const toggle = (indices: number[]) => {
		setSelected(current => {
			const next = new Set(current);
			const allSelected = indices.every(index => next.has(index));
			for (const index of indices) {
				if (allSelected) {
					next.delete(index);
				} else {
					next.add(index);
				}
			}

			return next;
		});
	};

	const updateFilter = (next: string) => {
		setFilter(next);
		setCursor(0);
	};

	useInput((input, key) => {
		const current = visible[cursor];

		if (key.upArrow) {
			move(-1);
		} else if (key.downArrow) {
			move(1);
		} else if (key.pageUp) {
			setCursor(c => Math.max(0, c - visibleCount));
		} else if (key.pageDown) {
			setCursor(c => Math.max(0, Math.min(visible.length - 1, c + visibleCount)));
		} else if (key.return) {
			if (multiple) {
				onSubmit(options.filter((_, index) => selected.has(index)).map(option => option.value));
			} else if (current !== undefined) {
				onSubmit([options[current]!.value]);
			}
		} else if (key.escape) {
			if (filter) {
				updateFilter('');
			} else {
				onBack?.();
			}
		} else if (key.backspace || key.delete) {
			updateFilter(filter.slice(0, -1));
		} else if (multiple && input === ' ') {
			if (current !== undefined) {
				toggle([current]);
			}
		} else if (multiple && key.ctrl && input === 'a') {
			toggle(visible);
		} else if (input && !key.ctrl && !key.meta && !key.tab) {
			updateFilter(filter + input);
		}
	});

	const start = Math.max(0, Math.min(cursor - Math.floor(visibleCount / 2), visible.length - visibleCount));
	const window = visible.slice(start, start + visibleCount);
	const hiddenAbove = start;
	const hiddenBelow = visible.length - start - window.length;

	const help = [
		'↑↓ move',
		multiple ? 'space select' : undefined,
		multiple ? 'ctrl+a all' : undefined,
		'type to filter',
		'enter confirm',
		onBack ? 'esc back' : undefined,
	].filter(Boolean);

	return (
		<Box flexDirection="column">
			{filter && (
				<Text>
					<Text dimColor>Filter: </Text>
					<Text color="cyan">{filter}</Text>
				</Text>
			)}
			{hiddenAbove > 0 && <Text dimColor>  ↑ {hiddenAbove} more</Text>}
			{window.map((index, position) => {
				const option = options[index]!;
				const isCursor = start + position === cursor;
				const isSelected = selected.has(index);
				return (
					<Text key={index} wrap="truncate-end">
						<Text color="cyan">{isCursor ? '❯ ' : '  '}</Text>
						{multiple && <Text color={isSelected ? 'green' : 'gray'}>{isSelected ? '◉ ' : '○ '}</Text>}
						<Text color={option.color} bold={isCursor} underline={isCursor && !option.color}>
							{option.label}
						</Text>
						{option.hint && <Text dimColor> {option.hint}</Text>}
					</Text>
				);
			})}
			{visible.length === 0 && <Text dimColor>  No matches</Text>}
			{hiddenBelow > 0 && <Text dimColor>  ↓ {hiddenBelow} more</Text>}
			{multiple && (
				<Text color="yellow">
					{selected.size > 0 ? `${selected.size} selected` : noneSelectedHint ?? 'Nothing selected'}
				</Text>
			)}
			<Text dimColor>{help.join(' · ')}</Text>
		</Box>
	);
}
