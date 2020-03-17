import { RichEmbed } from 'discord.js';
import config from 'config';
import moment from 'moment';
import { promisify } from 'util';
import req from 'request';
import { register } from './poller';
import logger from '../../logger';

const request = promisify(req);

const log = logger('plugins:reposts');

export default async function reposts(discord) {
	log.info('setting up reddit reposts plugin');

	const channelName = config.get('reposts.channel');
	const repostChannel = discord.channels.find(channel => channel.name === channelName);
	const repostRules = config.get('reposts.rules');
	const sources = Object.keys(repostRules);

	const sourcesObj = config.get('reposts.sources');
	const sourceIds = Object.keys(repostRules).map(sub => sourcesObj[sub]);

	async function repostChecker(submission) {
		const subreddit = submission.subreddit.display_name.toLowerCase();
		const rules = repostRules[subreddit];
		if (!rules || !submission.url) {
			return;
		}

		const response = await request({
			url: `https://redditbooru.com/images/?imageUri=${encodeURIComponent(submission.url)}`,
			headers: {
				'User-Agent': 'MoeBot repost checker',
				Cookie: `sources=${encodeURIComponent(sourceIds.join(','))}`,
			},
		});

		let similarity;
		try {
			similarity = JSON.parse(response.body);
		} catch (e) {
			log.error(`Error parsing json. Response was ${response.statusCode}\n${response.body}`, e);
			return;
		}
		const repost = similarity.results.find((result) => {
			const isMatch = result.externalId !== submission.id
				&& result.sourceName === subreddit
				&& result.distance < 0.05;
			const exceedsScore = rules.maxScore && rules.maxScore < result.score;
			const tooSoon = rules.maxAge && rules.maxAge > result.age;
			return isMatch && result.visible && (exceedsScore || tooSoon);
		});

		if (repost) {
			log.info(`Found repost for ${submission.url}: ${repost.externalId}`);

			await repostChannel.send(`Found a potential repost in ${subreddit}:`);

			const repostMessage = new RichEmbed();
			repostMessage.title = `Posted by ${submission.author.name}`;
			repostMessage.url = `https://reddit.com/${submission.id}`;
			repostMessage.image = { url: submission.url };

			await repostChannel.send(repostMessage);

			const originalMessage = new RichEmbed();
			const postTime = moment().subtract(repost.age, 'seconds').fromNow();
			originalMessage.title = `Original posted by ${repost.userName} (${postTime})`;
			originalMessage.url = `https://reddit.com/${repost.externalId}`;
			originalMessage.image = { url: repost.cdnUrl };

			await repostChannel.send(originalMessage);
		}
	}

	log.info(`Registering the following subreddits for polling: ${sources.join(', ')}`);
	sources.forEach(subreddit => register(subreddit, repostChecker));
}
