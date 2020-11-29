import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import Discord from 'discord.js';
import config from 'config';
import logger from '../logger';

const log = logger('plugins:eventlog');
const adapter = new FileSync(config.get('reactions.file'));
const db = low(adapter);

db.defaults({ reactions: [] })
	.write();

const events = {
	MESSAGE_REACTION_ADD: 'messageReactionAdd',
	MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
};

function getTopReactions(count) {
	return db.get('reactions')
		.orderBy('count', 'desc')
		.take(count)
		.value();
}

function addReaction(name) {
	try {
		const reaction = db.get('reactions')
			.find({ id: name })
			.value();
		if (!reaction) {
			db.get('reactions')
				.push({ id: name, count: 1 })
				.write();
		} else {
			db.get('reactions')
				.find({ id: name })
				.assign({ count: reaction.count + 1 })
				.write();
		}
	} catch (e) {
		log.error('Error adding an reaction to the database', e);
	}
}

function removeReaction(name) {
	try {
		const reaction = db.get('reactions')
			.find({ id: name })
			.value();
		if (reaction) {
			db.get('reactions')
				.find({ id: name })
				.assign({ count: reaction.count > 0 ? reaction.count - 1 : 0 })
				.write();
		}
	} catch (e) {
		log.error('Error removing an reaction from the database', e);
	}
}

function getReaction(name) {
	try {
		if (name.startsWith('<')) {
			return db.get('reactions')
				.find({ id: name.substring(2, name.length - 1) })
				.value();
		}
		return db.get('reactions')
			.find({ id: name })
			.value();
	} catch (e) {
		log.error(`Error getting reaction ${name}`, e);
		return null;
	}
}

/*
	Returns true if the bot has access to the given emoji and can use it in a message.
*/
function isSupportedEmoji(emojiId, discord) {
	return !emojiId.includes(':') || discord.emojis.has(emojiId.split(':').pop());
}

function isPrivateOrOwnMessage(reaction, user) {
	return reaction.message.author.id === user.id || reaction.message.channel.type === 'dm';
}

export default async function eventlog(discord) {
	log.info('starting eventlog plugin');

	/*
		As messageReactionAdd and messageReactionRemove events
		trigger only for messages that have been cached, we are using the raw feed
		which contains all events that happen to find the reaction events that happen on uncached messages.
		These events are then emitted to be handled by messageReactionAdd and messageReactionRemove listeners.
	*/
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
			log.info('Message', message);
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
		if (!isPrivateOrOwnMessage(reaction, user)) {
			log.info(`${user.username} reacted with "${reaction.emoji.name}".`);
			addReaction((reaction.emoji.id) ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name);
		}
	});

	discord.on('messageReactionRemove', (reaction, user) => {
		if (!isPrivateOrOwnMessage(reaction, user)) {
			log.info(`${user.username} removed their "${reaction.emoji.name}" reaction.`);
			removeReaction((reaction.emoji.id) ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name);
		}
	});

	discord.on('message', (message) => {
		if (message.content.startsWith('!topreactions')) {
			const topReactions = getTopReactions(10);
			const embed = new Discord.RichEmbed();
			let description = 'Most used reactions:\n\n';
			for (let i = 0; i < topReactions.length; i += 1) {
				let reaction;
				if (topReactions[i].id.includes(':')) {
					reaction = isSupportedEmoji(topReactions[i].id, discord)
						? `<:${topReactions[i].id}>`
						: topReactions[i].id.split(':').shift();
				} else {
					reaction = topReactions[i].id;
				}
				description += topReactions[i].count > 1 ? `${reaction} has been used ${topReactions[i].count} times.\n`
					: `${reaction} has been used once.\n`;
			}
			if (topReactions.length === 0) {
				description = 'No one has used any reactions yet :pensive:.';
			}
			embed.setDescription(description);
			message.channel.send(embed);
		} else if (message.content.startsWith('!reactions ')) {
			const embed = new Discord.RichEmbed();
			let reactionName = message.content.substring(11).split().pop();
			const reaction = getReaction(reactionName);

			let description;
			if (!reaction || !reaction.count) {
				description = `The reaction has never been used, or it is not a valid reaction. 
				The syntax for the command is "**!reactions :bird:**".`;
			} else {
				if (!isSupportedEmoji(reaction.id, discord)) {
					reactionName = reaction.id.split(':').shift();
				}
				description = reaction.count > 1 ? `Reaction ${reactionName} has been used ${reaction.count} times.`
					: `Reaction ${reactionName} has been used once.`;
			}
			embed.description = description;
			message.channel.send(embed);
		}
	});
}
