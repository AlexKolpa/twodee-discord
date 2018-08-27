/* eslint-disable no-console */

function logPrefix(scope, level) {
	return `${new Date().toISOString()} [${scope}] ${level}:`;
}

export default function logger(scope) {
	return {
		info(...args) {
			console.info(logPrefix(scope, 'info'), ...args);
		},
		warn(...args) {
			console.warn(logPrefix(scope, 'warn'), ...args);
		},
		error(...args) {
			console.error(logPrefix(scope, 'error'), ...args);
		},
	};
}
