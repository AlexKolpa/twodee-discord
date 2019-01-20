import { RichEmbed } from 'discord.js';
import { promisify } from 'util';
import req from 'request';
import logger from '../logger';

const log = logger('plugins:animeinfo');
const request = promisify(req);

const months = ['January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'];
const maxResults = 3;

function getTitle(anime) {
	if (anime.title) {
		if (anime.title.romaji) {
			return anime.title.romaji;
		} if (anime.title.english) {
			return anime.title.english;
		}
		return anime.title.native;
	}
	log.warn(`Anime with id ${anime.id} is missing a title.`);
	return `Unknown anime with id ${anime.id}`;
}

function secondsToDhms(s) {
	const seconds = Number(s);
	const d = Math.floor(seconds / (3600 * 24));
	const h = Math.floor((seconds % (3600 * 24)) / 3600);
	const m = Math.floor((seconds % 3600) / 60);

	const dDisplay = d > 0 ? d + (d === 1 ? ' day, ' : ' days, ') : '';
	const hDisplay = h > 0 ? h + (h === 1 ? ' hour, ' : ' hours, ') : '';
	const mDisplay = m > 0 ? m + (m === 1 ? ' minute' : ' minutes') : '';
	if (d > 0) {
		return (dDisplay + hDisplay).slice(0, -2);
	}
	return hDisplay + mDisplay;
}

function getAiringAt(anime) {
	let airingAt;
	if (anime.nextAiringEpisode) {
		const secondsUntilAiring = anime.nextAiringEpisode.timeUntilAiring;
		airingAt = secondsToDhms(secondsUntilAiring);
	} else if (anime.startDate) {
		const year = anime.startDate.year;
		const month = anime.startDate.month;
		if (month && year) {
			airingAt = `${months[month - 1]} ${year}`;
		} else if (year) {
			airingAt = year;
		}
	}
	return airingAt;
}

function getReleasingDescription(anime) {
	const title = getTitle(anime);
	let description = '';
	if (anime.nextAiringEpisode) {
		const episode = anime.nextAiringEpisode.episode;
		if (episode) {
			description += `Episode ${episode} of `;
		}
	}
	if (anime.nextAiringEpisode) {
		description += `**${title}** airs in ${getAiringAt(anime)}.`;
	} else {
		description += `**${title}** started airing in ${getAiringAt(anime)}.`;
	}
	return description;
}

function getUntilAiringString(anime) {
	const airingAt = getAiringAt(anime);
	return airingAt ? `It will air in ${airingAt}.` : '';
}

function getNotYetReleasedDescription(anime) {
	return `**${getTitle(anime)}** has not yet aired. ${getUntilAiringString(anime)}`;
}

function getMessage(data) {
	const message = new RichEmbed();
	try {
		message.description = '';
		const totalAnime = data.data.Page.pageInfo.total;
		if (totalAnime > maxResults) {
			message.description += `Found ${totalAnime} airing or upcoming anime. Showing the first ${maxResults}:\n`;
		}
		data.data.Page.media.forEach((anime) => {
			if (!message.thumbnail) {
				message.setThumbnail(anime.coverImage.large);
			}
			if (anime.status === 'RELEASING') {
				if (message.description.length > 0) message.description += '\n';
				message.description += getReleasingDescription(anime);
			} else if (anime.status === 'NOT_YET_RELEASED') {
				if (message.description.length > 0) message.description += '\n';
				message.description += getNotYetReleasedDescription(anime);
			}
		});
		if (data.data.Page.media.length === 0) {
			message.description += 'Could not find any airing or upcoming anime with that search term. Try again!';
		}
	} catch (e) {
		return log.error('Failed to create anime Discord message.', e);
	}
	return message;
}

async function getAnimeInfo(searchTerm) {
	const query = `
	query ($search: String, $sort: [MediaSort], $type: MediaType, $isAdult: Boolean, $status_in: [MediaStatus]) {
		Page (page: 1, perPage: ${maxResults}) {
			pageInfo {
				total
			}
			media (search: $search, sort: $sort, type: $type, isAdult: $isAdult, status_in: $status_in) {
				id
				title {
					romaji
					english
					native
				}
				nextAiringEpisode {
					timeUntilAiring
					episode
				}
				status
				endDate{
					year
					month
					day
				}
				startDate{
					year
					month
					day
				}
				coverImage{
					large
				}
			}
		}
	}`;

	const variables = {
		search: searchTerm,
		sort: ['STATUS', 'POPULARITY_DESC'],
		type: 'ANIME',
		isAdult: false,
		status_in: ['RELEASING', 'NOT_YET_RELEASED'],
	};

	const url = 'https://graphql.anilist.co';
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		body: JSON.stringify({
			query,
			variables,
		}),
	};
	let body;
	try {
		const data = await request(url, options);
		return JSON.parse(data.body);
	} catch (e) {
		log.error('Anilist API query failed. ', e);
	}
	return body;
}

export default async function when(discord) {
	log.info('starting animeinfo plugin');
	discord.on('message', async (msg) => {
		if (msg.content.startsWith('!when ')) {
			const query = msg.content.substr(6);
			const data = await getAnimeInfo(query);
			const message = getMessage(data);
			msg.channel.send(message);
		}
	});
}
