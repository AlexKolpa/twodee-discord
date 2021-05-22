import { RichEmbed } from 'discord.js';
import Pixiv from 'pixiv.ts';
import config from 'config';
import logger from '../logger';

const regex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)?/gi;
const kotoriPixivApi = 'https://api.pixiv.moe';
const scheme = 'https://';

const log = logger('plugins:pixiv');
let refreshToken = config.get('pixiv.refreshToken');
let client;

export default async function pixiv(discord) {
	log.info('starting pixiv plugin');

	try {
		client = await Pixiv.refreshLogin(refreshToken);
		log.info('Logged in to Pixiv with refresh token');
	} catch (e) {
		log.error('Failed to login to Pixiv, improved Pixiv previews will not be available', e);
	}

	discord.on('message', async (msg) => {
		const urls = msg.content.match(regex);
		if (client && urls && urls[0].startsWith('https://www.pixiv.net')) {
			try {
				const url = urls[0];
				const illust = await client.illust.get(url);
				let directUrl = illust.image_urls.large;
				if (directUrl.startsWith(scheme)) {
					directUrl = directUrl.substring(0, scheme.length);
				}

				const imageUrl = `${kotoriPixivApi}/image/${directUrl}`;
				log.info(`showing preview ${imageUrl}`);

				const embed = new RichEmbed({
					title: `${illust.title} by ${illust.user.name}`,
					url,
					image: {
						url: imageUrl,
					},
				});
				await msg.channel.send(embed);
			} catch (e) {
				log.error('Error replacing Pixiv preview', e);
			}
		}
	});


	const interval = setInterval(async () => {
		try {
			log.info('Updating Pixiv refresh token...');
			refreshToken = await client.refreshToken(refreshToken);
			client = await Pixiv.refreshLogin(refreshToken);
			log.info('Pixiv refresh token and login updated');
		} catch (e) {
			log.error('Error updating Pixiv refresh token and login', e);
			client = null;
		}
	}, 24 * 60 * 60 * 1000);

	return () => {
		clearInterval(interval);
	};
}
