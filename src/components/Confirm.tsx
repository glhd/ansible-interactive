import {Box, Text, useInput} from 'ink';
import {useEffect, useState} from 'react';
import {formatCommand, isCheckMode} from '../lib/command.js';

type Props = {
	argv: string[];
	cwd: string;
	/** Seconds to wait before a live run starts */
	delay: number;
	onConfirm: () => void;
	onBack?: () => void;
};

export function Confirm({argv, cwd, delay, onConfirm, onBack}: Props) {
	const check = isCheckMode(argv);
	const [remaining, setRemaining] = useState(check ? 0 : delay);

	useEffect(() => {
		if (remaining <= 0) {
			onConfirm();
			return;
		}

		const timer = setTimeout(() => setRemaining(r => r - 1), 1000);
		return () => clearTimeout(timer);
	}, [remaining]);

	useInput((_input, key) => {
		if (key.escape && remaining > 0) {
			onBack?.();
		}
	});

	return (
		<Box flexDirection="column" marginTop={1}>
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={check ? 'green' : 'red'}
				paddingX={1}
			>
				<Text>
					<Text dimColor>Working dir </Text>
					<Text color="blue">{cwd}</Text>
				</Text>
				<Text>
					<Text dimColor>Command     </Text>
					<Text color="yellow">{formatCommand(argv)}</Text>
				</Text>
				<Text>
					<Text dimColor>Mode        </Text>
					{check ? (
						<Text color="green">Check mode (no changes applied)</Text>
					) : (
						<Text color="red" bold>
							Live mode (will apply changes)
						</Text>
					)}
				</Text>
			</Box>
			{remaining > 0 && (
				<Text color="red">
					Running in live mode in {remaining}s… press <Text bold>esc</Text> to go back or{' '}
					<Text bold>ctrl+c</Text> to cancel
				</Text>
			)}
		</Box>
	);
}
