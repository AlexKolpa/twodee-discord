import config from 'config';
import { RichEmbed } from 'discord.js';
import logger from '../../logger';
import emotesPromise from './db';

const log = logger('plugins:emotes');

export default async function emotes(discord) {
	const editRoles = config.get('emotes.editRoles');

	const emotesDb = await emotesPromise;

	function listEmotes() {
		const response = new RichEmbed();
		response.title = 'Custom Reactions';
		const emotesList = emotesDb.list();
		if (emotesList.length > 0) {
			response.description = emotesList.map(emote => `${emote.id}: !${emote.trigger}`).join('\n');
		} else {
			response.description = 'No custom emotes yet';
		}

		return response;
	}

	async function addEmote(msg) {
		if (!editRoles.some(role => msg.member.roles.has(role))) {
			const response = new RichEmbed();
			response.description = 'You don\'t have the correct permissions to add emotes!';
			return response;
		}

		const message = msg.content.split(' ');
		if (message.length < 3) {
			const response = new RichEmbed();
			response.description = 'Make sure to provide a trigger and a message';
			return response;
		}

		if (message[2].startsWith('!')) {
			const response = new RichEmbed();
			response.description = 'Can\'t start a message with a command';
			return response;
		}

		let newCommand = message[1];
		if (newCommand.startsWith('!')) {
			newCommand = newCommand.substring(1);
		}

		try {
			const emote = await emotesDb.add({ trigger: newCommand, message: message.slice(2).join(' ') });
			const response = new RichEmbed();
			response.fields = [
				{ name: 'Custom reaction added', value: emote.id },
				{ name: 'Trigger', value: emote.trigger },
				{ name: 'Response', value: emote.message },
			];
			return response;
		} catch (e) {
			log.error(`Unable to save emote ${e}`);
			const response = new RichEmbed();
			response.description = 'Could not save emotes';
			return response;
		}
	}

	async function deleteEmote(msg) {
		if (!editRoles.some(role => msg.member.roles.has(role))) {
			const response = new RichEmbed();
			response.description = 'You don\'t have the correct permissions to delete emotes!';
			return response;
		}

		const message = msg.content.split(' ');
		const id = Number(message[1]);
		try {
			const emote = await emotesDb.delete(id);
			if (!emote) {
				const response = new RichEmbed();
				response.description = `Could not find emote ${id}. Use !lcr to list emotes`;
				return response;
			}
			const response = new RichEmbed();
			response.fields = [
				{ name: 'Custom reaction deleted', value: emote.id },
				{ name: 'Trigger', value: emote.trigger },
				{ name: 'Response', value: emote.message },
			];
			return response;
		} catch (e) {
			log.error(`Unable to delete emote ${e}`);
			const response = new RichEmbed();
			response.description = 'Could not delete emote';
			return response;
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
			channel.send(response);
		}
	});

	return async () => {
		await emotesDb.close();
	};
}
