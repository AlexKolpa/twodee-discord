import config from 'config';
import { RichEmbed } from 'discord.js';
import opengraph from 'open-graph';
import Parser from 'rss-parser';
import { promisify } from 'util';

import logger from '../logger';

const log = logger('plugins:news');

const ogParser = promisify(opengraph);

async function getLatestPost(parser, url) {
	const feed = await parser.parseURL(url);
	return new Date(feed.items[0].pubDate).getTime();
}

function submit(channel) {
	return (post) => {
		const message = new RichEmbed();
		message.title = post.title;
		message.url = post.url;
		message.thumbnail = { url: post.image };
		channel.send(message);
	};
}

async function parseItem(item) {
	const meta = await ogParser(item.link);

	let image = null;
	if (meta && meta.image) {
		if (Array.isArray(meta.image.url) && meta.image.url.length > 0) {
			image = meta.image.url[0];
		} else if (typeof meta.image.url === 'string') {
			image = meta.image.url;
		}
	}
	return {
		title: item.title,
		url: item.link,
		image,
	};
}

function isNewerThan(timestamp) {
	return (post) => {
		const postTimestamp = new Date(post.pubDate).getTime();
		return postTimestamp > timestamp;
	};
}

export default async function news(discord) {
	log.info('starting news plugin');
	const channelName = config.get('news.channel');
	const discordChannel = discord.channels.find((channel) => channel.name === channelName);
	const channel = config.get('news.url');

	log.info(`fetching from the following channel: ${channel}`);

	const parser = new Parser();
	let latestPost = await getLatestPost(parser, channel);

	log.info('setting up polling');

	const interval = setInterval(async () => {
		log.info('polling');
		const feed = await parser.parseURL(channel);
		const posts = [];

		const newItems = feed.items.filter(isNewerThan(latestPost));

		log.info(`Found ${newItems.length} new news posts`);

		// Intentionally do each parse sequentially, as we're otherwise effectively DDoSing the channel
		// eslint-disable-next-line no-restricted-syntax
		for (const item of newItems) {
			// eslint-disable-next-line no-await-in-loop
			const post = await parseItem(item);
			posts.push(post);
		}

		posts.forEach(submit(discordChannel));

		latestPost = newItems.reduce((timestamp, item) => {
			const newTimestamp = new Date(item.pubDate).getTime();
			return newTimestamp > timestamp ? newTimestamp : timestamp;
		}, latestPost);
	}, 60 * 1000);

	return () => {
		clearInterval(interval);
	};
}
