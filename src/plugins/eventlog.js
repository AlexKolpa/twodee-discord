import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import logger from '../logger';

const log = logger('plugins:eventlog');
const adapter = new FileSync('db.json');
const db = low(adapter);

function addReaction(name) {
	log.info('Adding reaction', name);
	if (!db.has(name).value()) {
		log.info('Adding new!');
		db.set(name, 1)
			.write();
	} else {
		db.update(name, n => n + 1)
			.write();
	}
}

function getReactionCount(name) {
	if (name.startsWith('<')) {
		return db.get(name.substring(2).split(':').shift()).value();
	} return db.get(name).value();
}


export default async function eventlog(discord) {
	log.info('starting log plugin');
	discord.on('raw', (event) => {
		if (event.t === 'MESSAGE_REACTION_ADD') {
			log.info(event);
			const name = event.d.emoji.name;
			addReaction(name);
		}
	});

	discord.on('message', (message) => {
		if (message.content.startsWith('!reactions ')) {
			const reaction = message.content.substring(11).split().pop();
			message.channel.send(`Reaction ${reaction} has been used ${getReactionCount(reaction)} times.`);
		}
	});
}
