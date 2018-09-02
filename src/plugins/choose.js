import { RichEmbed } from 'discord.js';
import logger from '../logger';

const log = logger('plugins:choose');
const chooseVerbs = ['chose', 'prefers', 'is thinking', 'is pondering',
	'thinks of your best and picked', 'suggests', 'likes all of the options, but chose'];

export default async function choose(discord) {
	log.info('starting choose plugin');
	discord.on('message', (msg) => {
		if (msg.content.startsWith('!choose ')) {
			const channel = msg.channel;
			const choices = msg.content.substring(8).split(';');
			if (choices.length > 1) {
				const message = new RichEmbed();
				message.description = `
				:thinking: MoeBot ${chooseVerbs[Math.floor(Math.random() * chooseVerbs.length)]}...\n
				${choices[Math.floor(Math.random() * choices.length)]}!`;
				channel.send(message);
			}
		}
	});
}
