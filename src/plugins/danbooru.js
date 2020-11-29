import Client from 'danbooru';
import { RichEmbed } from 'discord.js';
import config from 'config';
import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import logger from '../logger';

const log = logger('plugins:eventlog');
const adapter = new FileSync(config.get('danbooru.file'));
const db = low(adapter);
db.defaults({ blacklist: [], commands: {} }).write();

let loginString;

if (config.has('danbooru.login') && config.has('danbooru.apiKey')) {
	const login = config.get('danbooru.login');
	const apiKey = config.get('danbooru.apiKey');
	loginString = `${login}:${apiKey}`;
}

const editRoles = config.get('danbooru.editRoles');
const client = new Client(loginString);

function admin(command, ...args) {
	switch (command) {
		case 'add': {
			const [cmd, tagString, channelString] = args;
			if (db.get('commands').has(cmd).value()) {
				return `Command '!${cmd}' already exists!`;
			}

			if (!tagString) {
				return `No tags specified for '!${cmd}'!`;
			}


			const tags = tagString.split(',');
			const channels = channelString ? channelString.split(',') : [];
			db.get('commands')
				.set(cmd, {
					tags,
					channels,
				})
				.write();

			return `Added command '!${cmd}' with tags '${tags.join(', ')}'!`;
		}
		case 'remove': {
			const [cmd] = args;
			if (!db.get('commands').has(cmd).value()) {
				return `Command '!${cmd}' does not exist!`;
			}

			db.get('commands')
				.unset(cmd)
				.write();

			return `Removed command '!${cmd}'!`;
		}
		case 'add-blacklist': {
			const [tag] = args;
			db.get('blacklist')
				.push(tag)
				.write();
			return `Tag '${tag}' has been added to the blacklist!`;
		}
		case 'remove-blacklist': {
			const [tag] = args;
			db.get('blacklist')
				.pull(tag)
				.write();
			return `Tag '${tag}' has been removed from the blacklist!`;
		}
		case 'show-blacklist': {
			const tags = db.get('blacklist').value().join(', ');
			return `The following tags are blacklisted: ${tags}`;
		}
		case 'add-channel': {
			const [cmdToUpdate, newChannel] = args;
			if (!db.get('commands').has(cmdToUpdate).value()) {
				return `Command '!${cmdToUpdate}' could not be found. Please create it first!`;
			}

			db.get('commands')
				.get(cmdToUpdate)
				.get('channels')
				.push(newChannel)
				.write();

			return `Added channel '${newChannel}' to '!${cmdToUpdate}'`;
		}
		case 'remove-channel': {
			const [cmdToUpdate, oldChannel] = args;
			if (!db.get('commands').has(cmdToUpdate)) {
				return `Command '!${cmdToUpdate}' could not be found. Please create it first!`;
			}

			db.get('commands')
				.get(cmdToUpdate)
				.get('channels')
				.pull(oldChannel)
				.write();

			return `Removed channel '${oldChannel}' from '!${cmdToUpdate}'!`;
		}
		case 'add-tag': {
			const [cmdToUpdate, tag] = args;
			if (!db.get('commands').has(cmdToUpdate).value()) {
				return `Command '!${cmdToUpdate}' could not be found. Please create it first!`;
			}

			db.get('commands')
				.get(cmdToUpdate)
				.get('tags')
				.push(tag)
				.write();

			return `Added tag '${tag}' to '!${cmdToUpdate}'!`;
		}
		case 'remove-tag': {
			const [cmdToUpdate, tag] = args;
			if (!db.get('commands').has(cmdToUpdate).value()) {
				return `Command '!${cmdToUpdate}' could not be found. Please create it first!`;
			}

			db.get('commands')
				.get(cmdToUpdate)
				.get('tags')
				.pull(tag)
				.write();

			return `Removed tag '${tag}' from '!${cmdToUpdate}'!`;
		}
		case 'list': {
			const commands = db.get('commands')
				.reduce((acc, val, key) => `${acc}\n!${key}: ${val.tags.join(', ')}`, '')
				.value();
			return `The following commands are available:${commands}`;
		}
		default:
			return `Unrecognized admin command '${command}'!`;
	}
}

export default async function danbooru(discord) {
	discord.on('message', async (msg) => {
		if (msg.content.startsWith('!dba')) {
			const guildMember = await msg.guild.fetchMember(msg.author);
			if (!editRoles.some(role => guildMember.roles.has(role))) {
				msg.channel.send(new RichEmbed({
					description: 'You don\'t have the correct permissions to edit commands!',
				}));
				return;
			}
			const dbArgs = msg.content.split(' ');
			// Drop !dba command
			dbArgs.shift();
			try {
				const response = admin(...dbArgs);
				if (response) {
					msg.channel.send(new RichEmbed({
						description: response,
					}));
				}
			} catch (e) {
				log.error(`Unexpected error updating danbooru config ${e}`);
				msg.channel.send(new RichEmbed({
					description: 'Error updating danbooru config!',
				}));
			}
		} else if (msg.content.startsWith('!')) {
			const [cmd, ...extraTags] = msg.content.substring(1).split(' ');
			const command = db.get('commands')
				.get(cmd)
				.value();
			if (!command) {
				// No command, probably for a different plugin
				return;
			}

			if (!command.channels.includes(msg.channel.name)) {
				msg.channel.send(new RichEmbed({
					description: `Command '!${cmd}' cannot be used in this channel!`,
				}));
				return;
			}

			const blacklisted = db.get('blacklist').value();
			// Ban blacklisted tags from user search
			const blacklistedTag = extraTags.find(tag => blacklisted.includes(tag));
			if (blacklistedTag) {
				msg.channel.send(new RichEmbed({
					description: `Use of tag '${blacklistedTag}' is not allowed!`,
				}));
				return;
			}

			const queryTags = [...extraTags, ...command.tags];
			if (queryTags.length === 0) {
				msg.channel.send(new RichEmbed({
					description: 'No tags provided!',
				}));
				return;
			}

			// Additionally explicitly strip blacklisted tags from request
			const tags = [...queryTags, ...blacklisted.map(tag => `-${tag}`)];
			// There's a max number of tags we can send to danbooru
			if (tags.length > 12) {
				msg.channel.send(new RichEmbed({
					description: 'Too many tags provided!',
				}));
				return;
			}
			const tagString = tags.join(' ');

			try {
				const [post] = await client.posts({
					limit: 1,
					random: true,
					tags: tagString,
				});

				if (!post) {
					msg.channel.send(new RichEmbed({
						description: `Nothing found for '${queryTags.join(' ')}'`,
					}));
					return;
				}

				msg.channel.send(new RichEmbed({
					title: `${post.id}`,
					url: `https://danbooru.donmai.us/posts/${post.id}?q=${encodeURIComponent(queryTags.join(' '))}`,
					image: { url: post.file_url },
				}));
			} catch (e) {
				log.error(`Unexpected error fetching danbooru post ${e}`);
			}
		}
	});
}
