import {Text} from 'ink';

export function Answer({label, value}: {label: string; value: string}) {
	return (
		<Text>
			<Text color="green">✔ </Text>
			<Text bold>{label}</Text>
			<Text dimColor> · </Text>
			<Text color="cyan">{value}</Text>
		</Text>
	);
}

export function Question({children}: {children: string}) {
	return (
		<Text>
			<Text color="cyan">? </Text>
			<Text bold>{children}</Text>
		</Text>
	);
}
