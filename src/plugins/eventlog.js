import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import Discord from 'discord.js';
import config from 'config';
import logger from '../logger';

const log = logger('plugins:eventlog');
const adapter = new FileSync(config.get('reactions.file'));
const db = low(adapter);

const events = {
	MESSAGE_REACTION_ADD: 'messageReactionAdd',
	MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
};

function addReaction(name) {
	try {
		if (!db.has(name).value()) {
			db.set(name, 1)
				.write();
		} else {
			db.update(name, n => n + 1)
				.write();
		}
	} catch (e) {
		log.error('Error adding an reaction to the database', e);
	}
}

function removeReaction(name) {
	try {
		if (db.has(name).value()) {
			db.update(name, n => (n > 0 ? n - 1 : 0))
				.write();
		}
	} catch (e) {
		log.error('Error removing an reaction from the database', e);
	}
}

function getReactionCount(name) {
	try {
		if (name.startsWith('<')) {
			return db.get(name.substring(2, name.length - 1)).value();
		} return db.get(name).value();
	} catch (e) {
		log.error(`Error getting a reaction count for reaction ${name}`, e);
		return null;
	}
}


export default async function eventlog(discord) {
	log.info('starting eventlog plugin');
	discord.on('raw', async (event) => {
		try {
			// eslint-disable-next-line no-prototype-builtins
			if (!events.hasOwnProperty(event.t)) {
				return;
			}
			const { d: data } = event;
			const user = discord.users.get(data.user_id);
			const channel = discord.channels.get(data.channel_id) || await user.createDM();

			if (channel.messages.has(data.message_id)) return;

			const message = await channel.fetchMessage(data.message_id);
			const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
			let reaction = message.reactions.get(emojiKey);
			if (!reaction) {
				// Create an object that can be passed through the event like normal
				const emoji = new Discord.Emoji(discord.guilds.get(data.guild_id), data.emoji);
				reaction = new Discord.MessageReaction(message, emoji, 1, data.user_id === discord.user.id);
			}
			discord.emit(events[event.t], reaction, user);
		} catch (e) {
			log.error('Error handling a raw event', e, event);
		}
	});

	discord.on('messageReactionAdd', (reaction, user) => {
		log.info(`${user.username} reacted with "${reaction.emoji.name}".`);
		addReaction((reaction.emoji.id) ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name);
	});

	discord.on('messageReactionRemove', (reaction, user) => {
		log.info(`${user.username} removed their "${reaction.emoji.name}" reaction.`);
		removeReaction((reaction.emoji.id) ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name);
	});

	discord.on('message', (message) => {
		if (message.content.startsWith('!reactions ')) {
			const embed = new Discord.RichEmbed();
			const reaction = message.content.substring(11).split().pop();
			const count = getReactionCount(reaction);
			let description;
			if (!count) {
				description = `The reaction has never been used, or it is not a valid reaction. 
				The syntax for the command is "**!reactions :bird:**".`;
			} else {
				description = count > 1 ? `Reaction ${reaction} has been used ${count} times.`
					: `Reaction ${reaction} has been used once.`;
			}
			embed.description = description;
			message.channel.send(embed);
		}
	});
}
