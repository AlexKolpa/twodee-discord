import { RichEmbed } from 'discord.js';
import searchYoutube from 'youtube-api-v3-search';
import config from 'config';
import logger from '../logger';

const log = logger('plugins:youtube');
const key = config.get('youtube.key');

export default async function youtube(discord) {
	log.info('starting choose plugin');
	discord.on('message', async (msg) => {
		if (msg.content.startsWith('!yt ')) {
			const query = msg.content.substring(4);
			if (query) {
				try {
					const res = await searchYoutube(key, { q: query, part: 'snippet', type: 'video' });
					if (res.items && res.items.length >= 1) {
						const id = res.items[0].id.videoId;
						const videoUrl = `https://www.youtube.com/watch?v=${id}`;
						msg.channel.send(videoUrl);
					} else {
						const message = new RichEmbed();
						message.description = 'Nothing found. Try again!';
						msg.channel.send(message);
					}
				} catch (error) {
					log.error('Youtube search error', error);
				}
			}
		}
	});
}
