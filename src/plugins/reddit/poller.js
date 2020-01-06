import Snoowrap from 'snoowrap';
import config from 'config';
import logger from '../../logger';

const log = logger('poller:reddit');

const snoowrap = new Snoowrap({
	userAgent: config.get('reddit.userAgent'),
	clientId: config.get('reddit.clientId'),
	clientSecret: config.get('reddit.clientSecret'),
	refreshToken: config.get('reddit.refreshToken'),
});

const subreddits = {};

let pollInterval;
const lastUpdate = {};


function startPolling() {
	pollInterval = setInterval(async () => {
		log.info('Polling subreddits');
		await Promise.all(Object.keys(subreddits).map(async (subreddit) => {
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

				if (submission.removed || submission.author.name === '[deleted]') {
					return;
				}

				const listeners = subreddits[subreddit];
				listeners.forEach((listener) => {
					try {
						listener(submission);
					} catch (e) {
						log.error('An error occurred while notifying one of the listeners', e);
					}
				});
			});

			lastUpdate[subreddit] = newLastUpdate;
		}));
	}, 30 * 1000);
}

export function fetchSubreddit(subreddit) {
	return snoowrap.getSubreddit(subreddit).fetch();
}

export async function register(subreddit, listener) {
	const listeners = subreddits[subreddit] || [];
	subreddits[subreddit] = listeners;

	if (listeners.length === 0) {
		// Ensure we fetch the latest post before submitting to the poller
		const submissions = snoowrap.getSubreddit(subreddit).getNew();
		lastUpdate[subreddit] = await submissions[0].created_utc;
	}

	listeners.push(listener);

	if (!pollInterval) {
		startPolling();
	}
}

export function stop() {
	if (pollInterval) {
		clearInterval(pollInterval);
	}
}
