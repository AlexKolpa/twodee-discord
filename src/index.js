import Discord from 'discord.js';
import config from 'config';
import reddit from './plugins/reddit';
import news from './plugins/news';
import logger from './logger';
import countdown from './plugins/countdown';

const log = logger('bot:main');

async function init() {
	log.info('starting up bot');
	const client = new Discord.Client();
	await client.login(config.get('discord.token'));

	log.info('starting plugins');
	const stops = await Promise.all([
		reddit(client),
		news(client),
		countdown(client),
	]);

	const signals = {
		SIGHUP: 1,
		SIGINT: 2,
		SIGTERM: 15,
	};

	Object.keys(signals).forEach((signal) => {
		process.on(signal, () => {
			log.info('shutting down');
			stops.forEach((stop) => {
				try {
					if (stop) {
						stop();
					}
				} catch (e) {
					log.error(`error stopping plugin: ${e}`);
				}
			});
			process.exit(128 + signals[signal]);
		});
	});
}

init();
