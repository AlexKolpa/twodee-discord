import { RichEmbed } from 'discord.js';
import logger from '../logger';
import { promisify } from 'util';
import req from 'request';

const log = logger('plugins:animeinfo');
const request = promisify(req);

function secondsToDhms(seconds) {
	seconds = Number(seconds);
	const d = Math.floor(seconds / (3600 * 24));
	const h = Math.floor(seconds % (3600 * 24) / 3600);
	const m = Math.floor(seconds % 3600 / 60);
	const s = Math.floor(seconds % 3600 % 60);

	const dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
	const hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
	const mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
	const sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
	return dDisplay + hDisplay + mDisplay + sDisplay;
}

export default async function when(discord) {
	log.info('starting animeinfo plugin');
	discord.on('message', async (msg) => {
		if (msg.content.startsWith('!when ')) {
			const query = msg.content.substr(6);
			const data = await getAnimeInfo(query);
			console.log(JSON.stringify(data, undefined, 2));
			const title = data.data.Media.title.romaji;
			const secondsUntilAiring = data.data.Media.nextAiringEpisode.timeUntilAiring;
			const episode = data.data.Media.nextAiringEpisode.episode;
			const message = new RichEmbed();
			message.description = `Episode ${episode} of ${title} airs in ${secondsToDhms(secondsUntilAiring)}.`;
			msg.channel.send(message);
		}
	});
}

async function getAnimeInfo(animeName) {
	var query = `
	query ($search: String, $status_not: MediaStatus) { # Define which variables will be used in the query (id)
	Media (search: $search, status_not: $status_not, type: ANIME) { # Insert our variables into the query arguments (id) (type: ANIME is hard-coded in the query)
		id
		title {
		romaji
		english
		native
		}
		nextAiringEpisode {
		airingAt
		timeUntilAiring
		episode
		}
	}
	}
	`;

	// Define our query variables and values that will be used in the query request
	var variables = {
		search: animeName,
		status_not: "FINISHED"
	};

	// Define the config we'll need for our Api request
	var url = 'https://graphql.anilist.co',
		options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: JSON.stringify({
				query: query,
				variables: variables
			})
		};

	// Make the HTTP Api request
	const data = await request(url, options);
	console.log(JSON.stringify(JSON.parse(data.body), undefined, 2));
	return JSON.parse(data.body);
}

function handleResponse(response) {
	return response.json().then(function (json) {
		return response.ok ? json : Promise.reject(json);
	});
}

function handleData(data) {
	const title = data.data.Media.title.english;
	const timeUntilAiring = data.data.Media.nextAiringEpisode.timeUntilAiring;
	const episode = data.data.Media.nextAiringEpisode.episode;
	console.log("Title: ", title);
	return data;
}

function handleError(error) {
	console.error('Error, check console');
	console.error(error);
}
