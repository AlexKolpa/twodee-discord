import { RichEmbed } from 'discord.js';
import { promisify } from 'util';
import req from 'request';
import moment from 'moment';
import logger from '../logger';

const log = logger('plugins:animeinfo');
const request = promisify(req);
const maxSeachResults = 5;
const maxUpcomingResults = 20;
const maxHoursUntilAiring = 24;
const maxHoursPast = 48;

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

function getAnilistLink(anime, title) {
	return `**[${title}](https://anilist.co/anime/${anime.id})**`;
}

function getAiringAt(anime) {
	let airingAt;
	if (anime.nextAiringEpisode) {
		const secondsUntilAiring = anime.nextAiringEpisode.timeUntilAiring;
		airingAt = moment().add(secondsUntilAiring, 'seconds').fromNow();
	} else if (anime.startDate) {
		const year = anime.startDate.year;
		const month = anime.startDate.month;
		if (month && year) {
			airingAt = moment([year, month - 1]).fromNow();
		} else if (year) {
			airingAt = year;
		}
	}
	return airingAt;
}

function getReleasingDescription(anime) {
	const aniListLink = getAnilistLink(anime, getTitle(anime));
	let description = '';
	const prevEp = anime.airingSchedule.edges.filter(n => n.node.timeUntilAiring < 0).pop();
	if (prevEp && prevEp.node.timeUntilAiring < 0 && prevEp.node.timeUntilAiring + maxHoursPast * 3600 > 0) {
		return `Episode ${prevEp.node.episode} of ${aniListLink}
		aired ${moment().add(prevEp.node.timeUntilAiring, 'seconds').fromNow()}.`;
	}
	if (anime.nextAiringEpisode) {
		const episode = anime.nextAiringEpisode.episode;
		if (episode) {
			description += `Episode ${episode} of `;
		}
	}
	if (anime.nextAiringEpisode) {
		description += `${aniListLink} airs ${getAiringAt(anime)}.`;
	} else {
		description += `${aniListLink} started airing ${getAiringAt(anime)}.`;
	}
	return description;
}

function capitalize(s) {
	if (typeof s !== 'string') return '';
	const lowercase = s.toLowerCase();
	return lowercase.charAt(0).toUpperCase() + lowercase.slice(1);
}

function getUntilAiringString(anime) {
	const airingAt = getAiringAt(anime);
	return airingAt ? `It will air ${airingAt}.` : '';
}

function getNotYetReleasedDescription(anime) {
	const aniListLink = getAnilistLink(anime, getTitle(anime));
	return `${aniListLink} has not yet aired. ${getUntilAiringString(anime)}`;
}

function getFinishedDescription(anime) {
	const aniListLink = getAnilistLink(anime, getTitle(anime));
	if (anime.endDate.day || anime.startDate.day) {
		// Movies and such have no end date, use start date instead
		const year = anime.endDate.year || anime.startDate.year;
		const month = anime.endDate.month || anime.startDate.month;
		const day = anime.endDate.day || anime.startDate.day;
		const ended = moment([year, month - 1, day]);
		if (moment().subtract(1, 'year').isAfter(ended)) {
			return `${aniListLink} aired in ${capitalize(anime.season)} ${year}.`;
		}
		return `${aniListLink} finished airing ${ended.fromNow()}.`;
	}
	return `${aniListLink} has finished airing.`;
}

function getMessage(data, description, maxResults) {
	const message = new RichEmbed();
	try {
		message.description = description;
		const totalAnime = data.data.Page.media.length;
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
			} else if (anime.status === 'FINISHED') {
				if (message.description.length > 0) message.description += '\n';
				message.description += getFinishedDescription(anime);
			}
		});
		if (data.data.Page.media.length === 0) {
			message.description += 'Could not find any anime with that search term. Try again!';
		}
	} catch (e) {
		return log.error('Failed to create anime Discord message.', e);
	}
	return message;
}

function getUpcomingMessage(data) {
	const description = `The following anime will air in the next ${maxHoursUntilAiring} hours:\n`;
	return getMessage(data, description, maxUpcomingResults);
}

function getSearchResultMessage(data) {
	return getMessage(data, '', maxSeachResults);
}

async function queryAnilist(query, variables) {
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

async function getAnimeByMediaIds(mediaIds) {
	const query = `
	query ($countryOfOrigin: CountryCode, $id_in: [Int], $type: MediaType, 
		$isAdult: Boolean, $status_in: [MediaStatus], $tag_not_in: [String]) {
		Page (page: 1, perPage: 100) {
			pageInfo {
				total
			}
			media (countryOfOrigin: $countryOfOrigin, id_in: $id_in, type: $type, 
				isAdult: $isAdult, status_in: $status_in, tag_not_in: $tag_not_in) {
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
				airingSchedule(notYetAired: false, page: 1, perPage: 25) {
					edges {
						node {
							episode,
							timeUntilAiring
					  	}
					}
				}
			}
		}
	}`;
	const variables = {
		countryOfOrigin: 'JP',
		id_in: mediaIds,
		type: 'ANIME',
		isAdult: false,
		status_in: ['RELEASING', 'NOT_YET_RELEASED'],
		tag_not_in: ['Kids'],
	};
	return queryAnilist(query, variables);
}

async function getUpcomingAnime(hoursUntilAiring) {
	const query = `
	query ($airingAt_lesser: Int, $airingAt_greater: Int) {
		Page (page: 1, perPage: 100) {
			airingSchedules (airingAt_lesser: $airingAt_lesser, airingAt_greater: $airingAt_greater) {
				mediaId
			}
		}
	}`;
	const now = Math.floor(Date.now() / 1000);
	const variables = {
		airingAt_lesser: now + 3600 * hoursUntilAiring,
		airingAt_greater: now,
	};

	const data = await queryAnilist(query, variables);
	const mediaIds = data.data.Page.airingSchedules.map(x => x.mediaId);
	return getAnimeByMediaIds(mediaIds);
}

async function findAnime(searchTerm) {
	const query = `
	query ($search: String, $sort: [MediaSort], $type: MediaType, $isAdult: Boolean, $status_in: [MediaStatus]) {
		Page (page: 1, perPage: ${maxSeachResults}) {
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
				season
				startDate{
					year
					month
					day
				}
				coverImage{
					large
				}
				synonyms
				airingSchedule(notYetAired: false, page: 1, perPage: 25) {
					edges {
						node {
							episode,
							timeUntilAiring
					  	}
					}
				}
			}
		}
	}`;

	const variables = {
		search: searchTerm,
		sort: ['SEARCH_MATCH', 'STATUS', 'POPULARITY_DESC'],
		type: 'ANIME',
		isAdult: false,
		status_in: ['FINISHED', 'RELEASING', 'NOT_YET_RELEASED'],
	};

	return queryAnilist(query, variables);
}

export default async function when(discord) {
	log.info('starting animeinfo plugin');
	discord.on('message', async (msg) => {
		if (msg.content.startsWith('!when ')) {
			const query = msg.content.substr(6);
			const data = await findAnime(query);
			const q = query.toLowerCase();
			data.data.Page.media = data.data.Page.media.filter(media => media.synonyms.some(s => s.toLowerCase().includes(q))
				|| (media.title.romaji && media.title.romaji.toLowerCase().includes(q))
				|| (media.title.native && media.title.native.toLowerCase().includes(q))
				|| (media.title.english && media.title.english.toLowerCase().includes(q)));
			const message = getSearchResultMessage(data);
			msg.channel.send(message);
		} else if (msg.content.startsWith('!today')) {
			const data = await getUpcomingAnime(maxHoursUntilAiring);
			data.data.Page.media.sort((a, b) => {
				if (a.nextAiringEpisode && !b.nextAiringEpisode) {
					return -1;
				} if (b.nextAiringEpisode && !a.nextAiringEpisode) {
					return 1;
				}
				return a.nextAiringEpisode.timeUntilAiring < b.nextAiringEpisode.timeUntilAiring ? -1 : 1;
			});
			const message = getUpcomingMessage(data);
			msg.channel.send(message);
		}
	});
}
