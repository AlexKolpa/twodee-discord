import { RichEmbed } from 'discord.js';
import config from 'config';
import logger from '../logger';

const emotes = config.get('menhera');
const log = logger('plugins:menhera');
const emoteCount = Object.keys(emotes).length;

function processMenheraComment(msg) {
	const split = msg.content.split(' ');
	const message = new RichEmbed();

	if (split.length !== 1) {
		const emote = split[1];
		if (emote === 'help') {
			const keys = Object.keys(emotes);
			keys.sort();
			message.description = `Usage: !mh/!menhera *emote*. 
			Testing in **#botspam** please!\nAvailable emotes:\n${keys.join(', ')}.`;
			msg.channel.send(message);
			return;
		}
		if (!Object.prototype.hasOwnProperty.call(emotes, emote)) {
			message.description = `No emote found: ${emote}. See !mh help for available emotes.`;
			msg.channel.send(message);
			return;
		}
		const list = emotes.get(emote);
		message.image = { url: list[Math.floor(Math.random() * list.length)] };
		msg.channel.send(message);
		return;
	}
	const randomEmote = Object.keys(emotes)[Math.floor(Math.random() * emoteCount)];
	const list = emotes.get(randomEmote);
	message.image = { url: list[Math.floor(Math.random() * list.length)] };
	message.description = randomEmote;
	msg.channel.send(message);
}

export default async function menhera(discord) {
	log.info(`starting menhera plugin. ${emoteCount} emotes loaded.`);
	discord.on('message', (msg) => {
		if (msg.content.startsWith('!menhera') || msg.content.startsWith('!mh')) {
			processMenheraComment(msg);
		}
	});
}
