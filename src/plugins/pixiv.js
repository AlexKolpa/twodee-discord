import { MessageAttachment, MessageEmbed } from 'discord.js';
import Pixiv from 'pixiv.ts';
import fs from 'fs';
import { promisify } from 'util';
import config from 'config';
import logger from '../logger';

const deleteFile = promisify(fs.unlink);
const log = logger('plugins:pixiv');
const urlRegex = /(https?:\/\/(?:www\.|(?!www))[^\s]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
let refreshToken = config.get('pixiv.refreshToken');
let client;

export default async function pixiv(discord) {
	log.info('starting pixiv plugin');

	log.info('Logging in to Pixiv with refresh token');
	try {
		client = await Pixiv.refreshLogin(refreshToken);
	} catch (e) {
		log.error('Failed to login to Pixiv, improved Pixiv previews will not be available', e);
	}

	discord.on('message', async (msg) => {
		const urls = msg.content.match(urlRegex);
		if (client && urls && urls[0].startsWith('https://www.pixiv.net')) {
			try {
				const url = urls[0];
				const pixivId = await client.util.parseID(url);
				const illust = await client.illust.get(url);
				await client.util.downloadIllust(url, './illust', 'medium');
				const filePath = `./../illust/${pixivId}.png`;
				const attachment = new MessageAttachment(filePath, 'preview.png');
				const embed = new MessageEmbed()
					.setTitle(`${illust.title} by ${illust.user.name}`)
					.setURL(url)
					.attachFiles(attachment)
					.setImage('attachment://preview.png');
				await msg.channel.send(embed);
				msg.suppressEmbeds(true);
				await deleteFile(filePath);
			} catch (e) {
				log.error('Error replacing Pixiv preview', e);
			}
		}
	});


	const interval = setInterval(async () => {
		try {
			log.info('Updating Pixiv refresh token...');
			refreshToken = await client.refreshToken(refreshToken);
			client = await Pixiv.refreshLogin(refreshToken);
			log.info('Pixiv refresh token and login updated');
		} catch (e) {
			log.error('Error updating Pixiv refresh token and login', e);
			client = null;
		}
	}, 24 * 60 * 60 * 1000);

	return () => {
		clearInterval(interval);
	};
}
