import { HttpsProxyAgent } from 'https-proxy-agent';
import cheerio from 'cheerio';
import fetch from 'node-fetch';
import 'dotenv/config.js';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const originalEmitWarning = process.emitWarning;

let suppressed = false;

/**
 * Don't emit the NODE_TLS_REJECT_UNAUTHORIZED warning while
 * we work on proper SSL verification.
 * https://github.com/cypress-io/cypress/issues/5248
 */
function suppress() {
	if (suppressed) {
		return;
	}

	suppressed = true;

	process.emitWarning = (warning, ...args) => {
		if (
			typeof warning === 'string' &&
			warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')
		) {
			// node will only emit the warning once
			// https://github.com/nodejs/node/blob/82f89ec8c1554964f5029fab1cf0f4fad1fa55a8/lib/_tls_wrap.js#L1378-L1384
			process.emitWarning = originalEmitWarning;

			return;
		}

		return originalEmitWarning.call(process, warning, ...args);
	};
}

function fetchWithTimeout(msecs: any, promise: any) {
	const timeout = new Promise((resolve, reject) => {
		setTimeout(() => {
			reject(
				new Error(
					`Timed out in ${
						msecs / 1000
					} seconds. Check your Cookie or network connection.`
				)
			);
		}, msecs);
	});
	return Promise.race([timeout, promise]);
}

async function getTiktokProfile({ username }: { username: string }) {
	// read cookies from env
	// Suppress nodejs tls issues due to proxy ssl issues
	suppress();

	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
	if (!username) {
		return {
			statusCode: 400,
			data: 'provide a valid username',
		};
	}

	try {
		const brightConfig = (process.env.BRIGHT_DATA_CREDENTIALS || '').split(':');
		const brightCredentials = {
			user: brightConfig[0],
			password: brightConfig[1],
		};
		const proxy = `https://${brightCredentials.user}-country-de:${brightCredentials.password}@zproxy.lum-superproxy.io:22225`;
		console.log(proxy);
		const fetchResponse = await fetchWithTimeout(
			5000,
			fetch(`https://www.tiktok.com/@${username}`, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.82 Safari/537.36',
				},
				agent: new HttpsProxyAgent(proxy),
			})
		);
		const fetchData = await fetchResponse.text();

		const $ = cheerio.load(fetchData);

		const displayPicture = $('.tiktok-1zpj2q-ImgAvatar.e1e9er4e1').attr('src');
		const userTitle = $('[data-e2e=user-title]').text();
		const userSubtitle = $('[data-e2e=user-subtitle]').text();

		const following = $('[data-e2e=following-count]').text();
		const followers = $('[data-e2e=followers-count]').text();
		const likes = $('[data-e2e=likes-count]').text();

		const userBio = $('[data-e2e=user-bio]').text();
		const userSocial = $('[data-e2e=user-link]').attr('href');

		const image = $('.tiktok-1itcwxg-ImgPoster.e1yey0rl1');
		const videos = $('.tiktok-yz6ijl-DivWrapper.e1u9v4ua1') as any;

		const videoList: any = {};

		for (let i = 0; i < videos.length; i++) {
			videoList[i] = {
				videoLink: videos[i].children[0].attribs.href,
				videoDescription: image[i].attribs.alt,
				videoCaptionImage: image[i].attribs.src,
			};
		}

		const result = {
			displayPictureUrl: displayPicture,
			userTitle,
			userSubtitle,
			followers,
			following,
			likes,
			userBio,

			// not every profile provides social media links
			userSocial: userSocial !== undefined ? userSocial : 'N/A',

			previewVideos: videoList,
		};
		
		console.log(result);
		
		return {
			statusCode: fetchResponse.status,
			data: result,
		};
	} catch (err) {
		//throw createError(err.statusCode, err.message, err.stack);
		return {
			statusCode: err.response.status,
			data: err.message,
		};
	}
}

getTiktokProfile({ username: 'khurrambutt281' });
