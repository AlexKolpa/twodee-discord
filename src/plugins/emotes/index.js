import config from 'config';
import { RichEmbed, Attachment } from 'discord.js';
import logger from '../../logger';
import emotesPromise from './db';

const log = logger('plugins:emotes');

const allowedKeys = ['color', 'image', 'description', 'title', 'thumbnail', 'url'];

export default async function emotes(discord) {
	const editRoles = config.get('emotes.editRoles');

	const emotesDb = await emotesPromise;

	function listEmotes(msg) {
		const emotesList = emotesDb.list();
		if (emotesList.length > 0) {
			const message = msg.content.split(' ');
			const sendAll = message.length > 1 && message[1] === 'all';
			if (sendAll) {
				if (!editRoles.some(role => msg.member.roles.has(role))) {
					return new RichEmbed({
						description: 'You don\'t have the correct permissions to list all emotes!',
					});
				}

				try {
					const emotesString = JSON.stringify(emotesList, null, 2);
					const buffer = Buffer.from(emotesString, 'utf8');
					const attachment = new Attachment(buffer, 'emotes.json');
					msg.author.send(attachment);
				} catch (e) {
					log.error(`unable to send emotes list ${e}`);
				}
				return undefined;
			}

			return new RichEmbed({
				description: [...new Set(emotesList.map(emote => emote.trigger))].map(x => `!${x}`).join('\n'),
			});
		}

		return new RichEmbed({
			description: 'No custom emotes yet',
		});
	}

	async function addEmote(msg) {
		if (!editRoles.some(role => msg.member.roles.has(role))) {
			return new RichEmbed({
				description: 'You don\'t have the correct permissions to add emotes!',
			});
		}

		const message = msg.content.split(' ');
		if (message.length < 3) {
			return new RichEmbed({
				description: 'Make sure to provide a trigger and a message',
			});
		}

		if (message[2].startsWith('!')) {
			return new RichEmbed({
				description: 'Can\'t start a message with a command',
			});
		}

		let newCommand = message[1];
		if (newCommand.startsWith('!')) {
			newCommand = newCommand.substring(1);
		}

		let response = message.slice(2).join(' ');
		if (response.startsWith('{')) {
			try {
				log.info(`parsing message object ${response}`);
				response = JSON.parse(response);
			} catch (e) {
				log.error(`Unable to parse object response ${e}`);
				return new RichEmbed({
					description: 'Unable to parse emote message',
				});
			}
			const invalidKeys = Object.keys(response).some(key => !allowedKeys.includes(key));
			if (invalidKeys) {
				return new RichEmbed({
					description: 'Unsupported keys found in emote message.',
				});
			}
		}

		try {
			const emote = await emotesDb.add({ trigger: newCommand, message: response });
			return new RichEmbed({
				fields: [
					{ name: 'Custom reaction added', value: emote.id },
					{ name: 'Trigger', value: emote.trigger },
					{ name: 'Response', value: JSON.stringify(emote.message) },
				],
			});
		} catch (e) {
			log.error(`Unable to save emote ${e}`);
			return new RichEmbed({
				description: 'Could not save emotes',
			});
		}
	}

	async function deleteEmote(msg) {
		if (!editRoles.some(role => msg.member.roles.has(role))) {
			return new RichEmbed({
				description: 'You don\'t have the correct permissions to delete emotes!',
			});
		}

		const message = msg.content.split(' ');
		const id = Number(message[1]);
		try {
			const emote = await emotesDb.delete(id);
			if (!emote) {
				return new RichEmbed({
					description: `Could not find emote ${id}. Use !lcr to list emotes`,
				});
			}
			return new RichEmbed({
				fields: [
					{ name: 'Custom reaction deleted', value: emote.id },
					{ name: 'Trigger', value: emote.trigger },
					{ name: 'Response', value: JSON.stringify(emote.message) },
				],
			});
		} catch (e) {
			log.error(`Unable to delete emote ${e}`);
			return new RichEmbed({
				description: 'Could not delete emote',
			});
		}
	}

	discord.on('message', async (msg) => {
		if (!msg.content.startsWith('!') || msg.author.bot) {
			return;
		}

		const channel = msg.channel;

		const message = msg.content.split(' ');
		const command = message[0].substring(1);

		let response;
		switch (command) {
			case 'lcr':
				response = await listEmotes(msg);
				break;
			case 'acr':
				response = await addEmote(msg);
				break;
			case 'dcr':
				response = await deleteEmote(msg);
				break;
			default: {
				response = emotesDb.getResponse(command);
				break;
			}
		}

		if (response) {
			if (typeof response === 'object') {
				channel.send(new RichEmbed(response));
			} else {
				channel.send(response);
			}
		}
	});

	return async () => {
		await emotesDb.close();
	};
}
