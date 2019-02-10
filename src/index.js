import Discord from 'discord.js';
import config from 'config';
import reddit from './plugins/reddit';
import news from './plugins/news';
import logger from './logger';
import countdown from './plugins/countdown';
import choose from './plugins/choose';
import eightball from './plugins/eightball';
import emotes from './plugins/emotes';
import kyuu from './plugins/kyuu';
import animeinfo from './plugins/animeinfo';
import youtube from './plugins/youtube';

const log = logger('bot:main');

async function init() {
	log.info('starting up bot');
	const client = new Discord.Client();
	await client.login(config.get('discord.token'));

	log.info('starting plugins');
	let stops;
	try {
		stops = await Promise.all([
			reddit(client),
			news(client),
			countdown(client),
			choose(client),
			eightball(client),
			emotes(client),
			kyuu(client),
			animeinfo(client),
			youtube(client),
		]);
	} catch (e) {
		log.error(`Unexpected exception setting up plugins ${e}`);
		process.exit(1);
	}

	const signals = {
		SIGHUP: 1,
		SIGINT: 2,
		SIGTERM: 15,
	};

	Object.keys(signals).forEach((signal) => {
		process.on(signal, async () => {
			log.info('shutting down');
			await Promise.all(stops.map(async (stop) => {
				try {
					if (stop) {
						await stop();
					}
				} catch (e) {
					log.error(`error stopping plugin: ${e}`);
				}
			}));
			process.exit(128 + signals[signal]);
		});
	});
}

init();
