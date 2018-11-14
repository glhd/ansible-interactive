
import json from 'rollup-plugin-json';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
	input: 'src/index.js',
	output: {
		file: 'dist/ansible-interactive.js',
		name: 'ansibleInteractive',
		format: 'cjs'
	},
	plugins: [ commonjs(), resolve(), json() ]
};
