import logger from '../logger';

const defaultCount = 10;
const log = logger('plugins:countdown');

export default async function countdown(discord) {
	log.info('starting countdown plugin');
	discord.on('message', (msg) => {
		if (msg.content.startsWith('.cd')) {
			const channel = msg.channel;

			const parts = msg.content.split(' ');
			let count = defaultCount;
			if (parts.length > 1) {
				count = Number(parts[1]) || defaultCount;
			}

			let currentCount = 0;

			const cd = setInterval(() => {
				channel.send(`${count - currentCount}`);

				currentCount += 1;

				if (currentCount > count) {
					clearInterval(cd);
				}
			}, 1000);
		}
	});
}
