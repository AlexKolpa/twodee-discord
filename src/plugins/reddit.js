import Snoowrap from 'snoowrap';
import { RichEmbed } from 'discord.js';
import config from 'config';
import logger from '../logger';

const log = logger('plugins:reddit');

const defaultBotColor = 12886584;
// Ensure a min of 60s between post creation and posting to Discord
const minPostTimeSec = 60;

export default async (discord) => {
	log.info('setting up reddit plugin');

	const channelName = config.get('reddit.channel');
	const redditChannel = discord.channels.find(channel => channel.name === channelName);
	const subreddits = config.get('reddit.subreddits');

	const snoowrap = new Snoowrap({
		userAgent: config.get('reddit.userAgent'),
		clientId: config.get('reddit.clientId'),
		clientSecret: config.get('reddit.clientSecret'),
		refreshToken: config.get('reddit.refreshToken'),
	});

	const lastUpdate = {};
	const subredditColors = {};

	log.info('fetching latest posts');

	await Promise.all(subreddits.map(async (subreddit) => {
		const subredditData = await snoowrap.getSubreddit(subreddit).fetch();
		if (subredditData.banner_background_color) {
			// Convert to number for discord
			subredditColors[subreddit] = parseInt(subredditData.banner_background_color.substring(1), 16);
		}
		const submissions = snoowrap.getSubreddit(subreddit).getNew();
		lastUpdate[subreddit] = await submissions[0].created_utc;
	}));

	const submissionsToPost = [];

	log.info(`setting up polling for ${subreddits}`);

	const pollInterval = setInterval(async () => {
		log.info('Polling subreddits');
		await Promise.all(subreddits.map(async (subreddit) => {
			const submissions = await snoowrap.getSubreddit(subreddit).getNew();
			const subredditLastUpdate = lastUpdate[subreddit];
			let newLastUpdate = subredditLastUpdate;
			submissions.forEach((submission) => {
				if (submission.created_utc <= subredditLastUpdate) {
					return;
				}

				if (submission.created_utc > newLastUpdate) {
					newLastUpdate = submission.created_utc;
				}

				if (submission.removed) {
					return;
				}

				log.info(`Scheduling ${submission.id} for submitting to Discord`);
				submissionsToPost.push(submission);
			});

			lastUpdate[subreddit] = newLastUpdate;
		}));
	}, 30 * 1000);

	log.info('setting up Discord submission queue drainer');

	const drainInterval = setInterval(() => {
		try {
			const time = new Date().getTime() / 1000;
			const newPosts = [];
			let nextIndex;
			do {
				nextIndex = submissionsToPost.findIndex(sub => sub.created_utc <= (time - minPostTimeSec));

				if (nextIndex !== -1) {
					newPosts.push(...submissionsToPost.splice(nextIndex, 1));
				}
			} while (nextIndex !== -1);

			if (newPosts.length > 0) {
				log.info(`posting ${newPosts.length} submission(s) to Discord`);
			}

			newPosts.forEach((submission) => {
				const message = new RichEmbed();
				message.title = `[${submission.subreddit.display_name}] [${submission.author.name}] ${submission.title}`;
				message.image = { url: submission.url };
				message.url = `https://reddit.com${submission.permalink}`;
				message.color = subredditColors[submission.subreddit.display_name.toLowerCase()] || defaultBotColor;

				redditChannel.send(message);
			});
		} catch (e) {
			log.error('Unable to share posts', e);
		}
	}, 1000);

	return () => {
		clearInterval(pollInterval);
		clearInterval(drainInterval);
	}
};
