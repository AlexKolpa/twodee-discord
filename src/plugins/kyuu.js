import { RichEmbed } from 'discord.js';
import request from 'request';
import logger from '../logger';

const log = logger('plugins:kyuu');

function sendErrorMessage(channel) {
	const message = new RichEmbed();
	message.description = 'Failed to retrieve a Kyuu chapter.';
	channel.send(message);
}

function postKyuu(kyuuLink, channel) {
	request(kyuuLink, (error, response, body) => {
		if (response.statusCode === 200) {
			const imageUrl = body.toString().match(/class="open" src="(.*?)" \/>/)[1];
			if (imageUrl) {
				const message = new RichEmbed();
				message.image = { url: imageUrl };
				channel.send(message);
			} else {
				sendErrorMessage(channel);
			}
		} else {
			sendErrorMessage(channel);
		}
	});
}

function postRandomKyuu(channel) {
	request('https://helveticascans.com/r/series/wonder-cat-kyuu-chan/', (error, response, body) => {
		let kyuuLinks = (body.toString().match(/title"><a href="(.*?)" title="Chapter /g));
		kyuuLinks = kyuuLinks.map(link => link.replace('title"><a href="', '').replace('" title="Chapter ', ''));
		const kyuuLink = kyuuLinks ? kyuuLinks[Math.round(Math.random() * (kyuuLinks.length - 1))] : null;
		if (kyuuLink) {
			postKyuu(kyuuLink, channel);
		}
	});
}

export default async function kyuu(discord) {
	log.info('starting kyuu plugin');
	discord.on('message', (msg) => {
		if (msg.content.startsWith('!kyuu')) {
			postRandomKyuu(msg.channel);
		}
	});
}
