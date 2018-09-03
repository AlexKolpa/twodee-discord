import fs from 'fs';
import config from 'config';
import { promisify } from 'util';
import logger from '../../logger';

const log = logger('plugins:emotes:db');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const emotesFile = config.get('emotes.file');

function buildTriggers(emoteList) {
	return Object.values(emoteList).reduce((acc, val) => {
		if (!acc[val.trigger]) {
			acc[val.trigger] = [];
		}
		acc[val.trigger].push(val.message);
		return acc;
	}, {});
}

async function writeEmotes(content) {
	const fileContent = JSON.stringify(content, null, 2);
	await writeFile(emotesFile, fileContent, 'utf8');
}

const emotes = new Promise(async (resolve) => {
	let emotesContent;

	try {
		const fileContent = await readFile(emotesFile, 'utf8');
		emotesContent = JSON.parse(fileContent);
		// Freeze objects to prevent changes being made outside this module
		emotesContent.list.forEach(emote => Object.freeze(emote));
	} catch (e) {
		log.warn(`unable to parse emotes file ${e}`);
		emotesContent = { sequence: 0, list: [] };
	}

	let triggers = buildTriggers(emotesContent.list);

	const emotesDb = {
		list() {
			return emotesContent.list.slice();
		},
		async add({ trigger, message }) {
			emotesContent.sequence += 1;
			const newId = emotesContent.sequence;
			const emote = {
				id: newId,
				trigger,
				message,
			};
			Object.freeze(emote);

			emotesContent.list.push(emote);

			triggers = buildTriggers(emotesContent.list);
			await writeEmotes(emotesContent);

			return emote;
		},
		async delete(id) {
			const index = emotesContent.list.findIndex(emote => emote.id === id);
			if (index === -1) {
				return undefined;
			}

			const [emote] = emotesContent.list.splice(index, 1);

			triggers = buildTriggers(emotesContent.list);
			await writeEmotes(emotesContent);

			return emote;
		},
		getResponse(command) {
			const trigger = triggers[command];
			if (!trigger) {
				return undefined;
			}

			return trigger[Math.floor(Math.random() * trigger.length)];
		},
		async close() {
			await writeEmotes(emotesContent);
		},
	};
	resolve(emotesDb);
});

export default emotes;
