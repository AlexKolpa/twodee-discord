import { RichEmbed } from 'discord.js';
import config from 'config';
import logger from '../logger';

const data = config.get('menhera');
const log = logger('plugins:menhera');

function objToStrMap(obj) {
	const strMap = new Map();
	Object.keys(obj).forEach((k) => {
		strMap.set(k, obj[k]);
	});
	return strMap;
}

const emotes = objToStrMap(data);

function processMenheraComment(msg) {
	const split = msg.content.split(' ');
	const message = new RichEmbed();
	if (split.length !== 1) {
		let list;
		if (split[1] === 'random') {
			list = emotes.get([...emotes.keys()][Math.floor(Math.random() * emotes.size)]);
		} else {
			list = emotes.get(split[1]);
			if (!list) {
				message.description = `No reaction found: ${split[1]}. See !mh or !menhera for available emotes.`;
				msg.channel.send(message);
				return;
			}
		}
		message.image = { url: list[Math.floor(Math.random() * list.length)] };
		msg.channel.send(message);
	}
	const keys = Array.from(emotes.keys());
	keys.sort();
	keys.push('random');
	message.description = `Usage: !mh/!menhera *emote*. 
	Testing in **#botspam** please!\nAvailable emotes:\n${keys.join(', ')}.`;
	msg.channel.send(message);
}

export default async function menhera(discord) {
	log.info(`starting menhera plugin. ${emotes.size} emotes loaded.`);
	discord.on('message', (msg) => {
		if (msg.content.startsWith('!menhera') || msg.content.startsWith('!mh')) {
			processMenheraComment(msg);
		}
	});
}
