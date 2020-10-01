import { RichEmbed } from 'discord.js';
import config from 'config';
import logger from '../logger';

const emotes = config.get('menhera');
const log = logger('plugins:menhera');

function processMenheraComment(msg) {
	const split = msg.content.split(' ');
	const message = new RichEmbed();
	if (split.length !== 1) {
		let list;
		if (split[1] === 'random') {
			list = emotes.get([...Object.keys(emotes)][Math.floor(Math.random() * Object.keys(emotes).length)]);
		} else {
			if (!emotes.hasOwnProperty(split[1])) {
				message.description = `No reaction found: ${split[1]}. See !mh or !menhera for available emotes.`;
				msg.channel.send(message);
				return;
			}
			list = emotes.get(split[1]);
		}
		message.image = { url: list[Math.floor(Math.random() * list.length)] };
		msg.channel.send(message);
		return;
	}
	const keys = Object.keys(emotes);
	keys.sort();
	keys.push('random');
	message.description = `Usage: !mh/!menhera *emote*. 
	Testing in **#botspam** please!\nAvailable emotes:\n${keys.join(', ')}.`;
	msg.channel.send(message);
}

export default async function menhera(discord) {
	log.info(`starting menhera plugin. ${Object.keys(emotes).length} emotes loaded.`);
	discord.on('message', (msg) => {
		if (msg.content.startsWith('!menhera') || msg.content.startsWith('!mh')) {
			processMenheraComment(msg);
		}
	});
}
