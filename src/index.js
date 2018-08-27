import Discord from 'discord.js';
import config from 'config';
import reddit from './plugins/reddit';
import logger from './logger';

const log = logger('bot:main');

async function init() {
	log.info('starting up bot');
	const client = new Discord.Client();
	await client.login(config.get('discord.token'));

	log.info('starting plugins');
	const stop = await reddit(client);

	const signals = {
		'SIGHUP' : 1,
		'SIGINT' : 2,
		'SIGTERM' : 15
	};

	Object.keys(signals).forEach((signal) => {
		process.on(signal, () => {
			log.info('shutting down');
			stop();
			process.exit(128 + signals[signal]);
		});
	});
}

init();
