import { RichEmbed } from 'discord.js';
import config from 'config';
import { fetchSubreddit, register } from './poller';
import logger from '../../logger';

const log = logger('plugins:reddit');

const defaultBotColor = 12886584;
// Ensure a min of 60s between post creation and posting to Discord
const minPostTimeSec = 60;

const messageTitleMaxLength = 256;
const messageDescMaxLength = 2048;

const recentUrls = [];
const minUrlAgeSec = 1800;

function limitLength(text, maxLength) {
	return text.length > maxLength ? `${text.substring(0, maxLength - 3)}...` : text;
}

function isSupportedImageLink(url) {
	// Yes this is an extremely lazy and not 100% accurate approach, but it suffices
	return (url.match(/\.(jpeg|jpg|gif|png)$/) != null);
}

function newerThan(seconds, time) {
	return time > Date.now() - seconds * 1000;
}

function escapeMarkdown(text) {
	return text.replace(/([^\\]|^|\*|_|`|~)(\*|_|`|~)/g, '$1\\$2');
}

export default async function redditFeed(discord) {
	log.info('setting up reddit feed plugin');

	const channelName = config.get('feed.channel');
	const redditChannel = discord.channels.find((channel) => channel.name === channelName);
	const subreddits = config.get('feed.subreddits');

	const subredditColors = {};

	log.info('fetching subreddit colors');

	await Promise.all(subreddits.map(async (subreddit) => {
		const subredditData = await fetchSubreddit(subreddit);
		if (subredditData.banner_background_color) {
			// Convert to number for discord
			subredditColors[subreddit] = parseInt(subredditData.banner_background_color.substring(1), 16);
		}
	}));

	const submissionsToPost = [];
	const listener = (submission) => {
		log.info(`Scheduling ${submission.id} for submission to feed`);
		submissionsToPost.push(submission);
	};

	log.info(`Registering the following subreddits for polling: ${subreddits.join(', ')}`);
	subreddits.forEach((subreddit) => register(subreddit, listener));

	log.info('setting up Discord submission queue drainer');

	const drainInterval = setInterval(async () => {
		try {
			const time = new Date().getTime() / 1000;
			let newPosts = [];
			let nextIndex;
			do {
				nextIndex = submissionsToPost.findIndex((sub) => sub.created_utc <= (time - minPostTimeSec));

				if (nextIndex !== -1) {
					newPosts.push(...submissionsToPost.splice(nextIndex, 1));
				}
			} while (nextIndex !== -1);

			if (newPosts.length === 0) {
				return;
			}

			// Fetch posts again as they might be outdated
			const submissions = await Promise.all(newPosts.map((post) => post.fetch()));
			// Ensure the posts haven't been removed or deleted in the mean time
			newPosts = submissions.filter((submission) => !submission.removed && submission.author.name !== '[deleted]');

			log.info(`posting ${newPosts.length} submission(s) to Discord`);

			newPosts.forEach((submission) => {
				if (recentUrls.some((item) => item.url && item.url === submission.url && newerThan(minUrlAgeSec, item.time))) {
					log.info(`Url ${submission.url} was already recently posted, skipping.`);
				} else {
					recentUrls.push({ url: submission.url, time: new Date().getTime() });
					if (recentUrls.length > 100) { recentUrls.shift(); }
					const message = new RichEmbed();
					const title = `[${submission.subreddit.display_name}] [${submission.author.name}] ${submission.title}`;
					message.title = escapeMarkdown(limitLength(title, messageTitleMaxLength));
					message.url = `https://reddit.com${submission.permalink}`;
					message.color = subredditColors[submission.subreddit.display_name.toLowerCase()] || defaultBotColor;
					if (submission.is_self) {
						message.description = escapeMarkdown(limitLength(submission.selftext, messageDescMaxLength));
					} else if (isSupportedImageLink(submission.url)) {
						message.image = { url: submission.url };
					}
					redditChannel.send(message);
				}
			});
		} catch (e) {
			log.error('Unable to share posts', e);
		}
	}, 1000);

	return () => {
		clearInterval(drainInterval);
	};
}
