import { RichEmbed } from 'discord.js';
import logger from '../logger';

const log = logger('plugins:eightball');
const responses = ['Most definitely yes', 'For sure', 'Totally', 'Of course!', 'As I see it, yes',
	'My sources say yes', 'Yes', 'Most likely', 'Perhaps', 'Not sure',
	'It is uncertain', 'Ask me again later', 'Don\'t count on it', 'Probably not',
	'Very doubtful', 'Most likely no', 'Nope', 'No', 'My sources say no',
	'Don\'t even think about it', 'Definitely no', 'Yes definitely', 'It is decidedly so',
	'It is certain', 'Concentrate and ask again', 'Without a doubt', 'Outlook good',
	'Signs point to yes', 'Better not tell you now'];

export default async function eightball(discord) {
	log.info('starting 8ball plugin');
	discord.on('message', (msg) => {
		if (msg.content.startsWith('!8ball ')) {
			const question = msg.content.substring(7);
			if (question.length > 0) {
				const message = new RichEmbed();
				message.description = `
				:question: **Question**\n
				${question}\n
				:8ball: **8ball**\n
				${responses[Math.floor(Math.random() * responses.length)]}`;
				msg.channel.send(message);
			}
		}
	});
}
