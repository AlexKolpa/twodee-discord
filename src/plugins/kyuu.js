import { RichEmbed } from 'discord.js';
import { promisify } from 'util';
import req from 'request';
import logger from '../logger';

const request = promisify(req);
const log = logger('plugins:kyuu');

function sendErrorMessage(channel) {
	const message = new RichEmbed();
	message.description = 'Failed to retrieve a Kyuu chapter.';
	channel.send(message);
}

async function postKyuu(kyuuLink, channel) {
	try {
		const result = await request(kyuuLink);
		const imageUrl = result.body.toString().match(/class="open" src="(.*?)" \/>/)[1];
		if (imageUrl) {
			const message = new RichEmbed();
			message.image = { url: imageUrl };
			channel.send(message);
		} else {
			logger.error('Failed to parse Kyuu imageurl from ', kyuuLink);
			sendErrorMessage(channel);
		}
	} catch (error) {
		logger.error(`Request using link '${kyuuLink}' failed: `, error);
		sendErrorMessage(channel);
	}
}

async function postRandomKyuu(channel) {
	try {
		const result = await request('https://helveticascans.com/r/series/wonder-cat-kyuu-chan/');
		let kyuuLinks = (result.body.toString().match(/title"><a href="(.*?)" title="Chapter /g));
		kyuuLinks = kyuuLinks.map(link => link.replace('title"><a href="', '').replace('" title="Chapter ', ''));
		const kyuuLink = kyuuLinks ? kyuuLinks[Math.round(Math.random() * (kyuuLinks.length - 1))] : null;
		if (kyuuLink) {
			await postKyuu(kyuuLink, channel);
		} else {
			logger.error('Failed to parse random Kyuu link from response.');
			sendErrorMessage(channel);
		}
	} catch (error) {
		log.error('Failed to retrieve main Kyuu page', error || '');
		sendErrorMessage(channel);
	}
}

export default async function kyuu(discord) {
	log.info('starting kyuu plugin');
	discord.on('message', (msg) => {
		if (msg.content.startsWith('!kyuu')) {
			postRandomKyuu(msg.channel);
		}
	});
}
