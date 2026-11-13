const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { toAudio } = require('../lib/converter');
const { adeelMedia } = require('../lib/mediaFallback');

const AXIOS_DEFAULTS = {
	timeout: 60000,
	headers: {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		'Accept': 'application/json, text/plain, */*'
	}
};

async function tryRequest(getter, attempts = 3) {
	let lastError;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await getter();
		} catch (err) {
			lastError = err;
			const status = err?.response?.status || err?.status;
			// 4xx responses (especially 402) are provider rejections, not transient
			// failures. Stop retrying this provider immediately so the next fallback runs.
			if (status >= 400 && status < 500 && status !== 429) break;
			if (attempt < attempts) await new Promise(r => setTimeout(r, 1000 * attempt));
		}
	}
	throw lastError;
}

// EliteProTech API - Primary (confirmed by the user's dashboard screenshot).
async function getEliteProTechDownloadByUrl(youtubeUrl) {
	const res = await tryRequest(() => axios.get('https://eliteprotech-apis.zone.id/download/ytmp3', {
		...AXIOS_DEFAULTS, params: { url: youtubeUrl }
	}));
	const body = res?.data;
	const result = body?.download || body?.result || body?.data || body;
	const download = result?.downloadUrl || result?.download_url || result?.downloadURL || result?.url || result?.link || result?.mp3;
	if ((body?.status === true || body?.success === true || body?.status == null) && typeof download === 'string' && /^https?:\/\//i.test(download) && !download.includes('/download/ytmp3')) {
		return { download, title: result?.title, thumbnail: result?.thumbnail, duration: result?.duration };
	}
	throw new Error('EliteProTech /download/ytmp3 returned no actual audio download URL');
}

async function getYupraDownloadByUrl(youtubeUrl) {
	const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
	const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
	if (res?.data?.success && res?.data?.data?.download_url) {
		return {
			download: res.data.data.download_url,
			title: res.data.data.title,
			thumbnail: res.data.data.thumbnail
		};
	}
	throw new Error('Yupra returned no download');
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
	const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
	const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
	// Okatsu response shape: { status, creator, title, format, thumb, duration, cached, dl }
	if (res?.data?.dl) {
		return {
			download: res.data.dl,
			title: res.data.title,
			thumbnail: res.data.thumb
		};
	}
	throw new Error('Okatsu ytmp3 returned no download');
}

async function getAdeelDownloadByUrl(youtubeUrl) {
	const res = await adeelMedia('ytmp3', youtubeUrl, 'audio');
	return { download: res.buffer, title: 'RAUF × LUCIFER MD BOT song' };
}

async function songCommand(sock, chatId, message) {
    try {
        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        // Accept direct .ytmp3/.mp3/.song links as well as plain song names.
        const text = rawText.replace(/^\.(?:ytmp3|mp3|song|play)\s*/i, '').trim();
        if (!text) {
            await sock.sendMessage(chatId, { text: 'Usage: .song <song name or YouTube link>' }, { quoted: message });
            return;
        }

        let video;
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
			video = { url: text };
        } else {
			const search = await yts(text);
			if (!search || !search.videos.length) {
                await sock.sendMessage(chatId, { text: 'No results found.' }, { quoted: message });
                return;
            }
			video = search.videos[0];
        }

        // Inform user
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🎵 Downloading: *${video.title}*\n⏱ Duration: ${video.timestamp}`
        }, { quoted: message });

		// Try multiple APIs with fallback chain: EliteProTech -> Yupra -> Okatsu
		let audioData;
		let audioBuffer;
		let downloadSuccess = false;
		
		// List of API methods to try
		const apiMethods = [
			{ name: 'EliteProTech', method: () => getEliteProTechDownloadByUrl(video.url) },
			{ name: 'Yupra', method: () => getYupraDownloadByUrl(video.url) },
			{ name: 'Okatsu', method: () => getOkatsuDownloadByUrl(video.url) },
			{ name: 'Adeel-XTech', method: () => getAdeelDownloadByUrl(video.url) }
		];
		
		// Try each API until we successfully download audio
		for (const apiMethod of apiMethods) {
			try {
				audioData = await apiMethod.method();
				const audioUrl = typeof audioData.download === 'string' ? audioData.download : null;
				if (Buffer.isBuffer(audioData.download)) {
					audioBuffer = audioData.download;
					if (audioBuffer.length) { downloadSuccess = true; break; }
				}
				
				if (!audioUrl) {
					console.log(`${apiMethod.name} returned no download URL, trying next API...`);
					continue; // Try next API
				}
				
				// Try to download the audio file - arraybuffer first
				try {
					const audioResponse = await axios.get(audioUrl, {
						responseType: 'arraybuffer',
						timeout: 90000,
						maxContentLength: Infinity,
						maxBodyLength: Infinity,
						decompress: true,
						validateStatus: s => s >= 200 && s < 400,
						headers: {
							'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
							'Accept': '*/*',
							'Accept-Encoding': 'identity'
						}
					});
					audioBuffer = Buffer.from(audioResponse.data);
					
					// Validate buffer
					if (audioBuffer && audioBuffer.length > 0) {
						downloadSuccess = true;
						break; // Success! Exit the loop
					}
				} catch (downloadErr) {
					// Check if it's a 451 error or other client/server error
					const statusCode = downloadErr.response?.status || downloadErr.status;
					if (statusCode === 451) {
						console.log(`Download blocked (451) from ${apiMethod.name}, trying next API...`);
						continue; // Try next API
					}
					
					// Try stream mode as fallback for this URL
					try {
						const audioResponse = await axios.get(audioUrl, {
							responseType: 'stream',
							timeout: 90000,
							maxContentLength: Infinity,
							maxBodyLength: Infinity,
							validateStatus: s => s >= 200 && s < 400,
							headers: {
								'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
								'Accept': '*/*',
								'Accept-Encoding': 'identity'
							}
						});
						const chunks = [];
						await new Promise((resolve, reject) => {
							audioResponse.data.on('data', c => chunks.push(c));
							audioResponse.data.on('end', resolve);
							audioResponse.data.on('error', reject);
						});
						audioBuffer = Buffer.concat(chunks);
						
						if (audioBuffer && audioBuffer.length > 0) {
							downloadSuccess = true;
							break; // Success! Exit the loop
						}
					} catch (streamErr) {
						// Stream mode also failed, try next API
						const streamStatusCode = streamErr.response?.status || streamErr.status;
						if (streamStatusCode === 451) {
							console.log(`Stream download blocked (451) from ${apiMethod.name}, trying next API...`);
						} else {
							console.log(`Stream download failed from ${apiMethod.name}:`, streamErr.message);
						}
						continue; // Try next API
					}
				}
			} catch (apiErr) {
				// API call failed, try next API
				console.log(`${apiMethod.name} API failed:`, apiErr.message);
				continue;
			}
		}
		
		// If all APIs failed, throw error
		if (!downloadSuccess || !audioBuffer) {
			throw new Error('All download sources failed. The content may be unavailable or blocked in your region.');
		}

		// Validate buffer
		if (!audioBuffer || audioBuffer.length === 0) {
			throw new Error('Downloaded audio buffer is empty');
		}

		// Detect actual file format from signature
		const firstBytes = audioBuffer.slice(0, 12);
		const hexSignature = firstBytes.toString('hex');
		const asciiSignature = firstBytes.toString('ascii', 4, 8);

		let actualMimetype = 'audio/mpeg';
		let fileExtension = 'mp3';
		let detectedFormat = 'unknown';

		// Check for MP4/M4A (ftyp box)
		if (asciiSignature === 'ftyp' || hexSignature.startsWith('000000')) {
			// Check if it's M4A (audio/mp4)
			const ftypBox = audioBuffer.slice(4, 8).toString('ascii');
			if (ftypBox === 'ftyp') {
				detectedFormat = 'M4A/MP4';
				actualMimetype = 'audio/mp4';
				fileExtension = 'm4a';
			}
		}
		// Check for MP3 (ID3 tag or MPEG frame sync)
		else if (audioBuffer.toString('ascii', 0, 3) === 'ID3' || 
		         (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0)) {
			detectedFormat = 'MP3';
			actualMimetype = 'audio/mpeg';
			fileExtension = 'mp3';
		}
		// Check for OGG/Opus
		else if (audioBuffer.toString('ascii', 0, 4) === 'OggS') {
			detectedFormat = 'OGG/Opus';
			actualMimetype = 'audio/ogg; codecs=opus';
			fileExtension = 'ogg';
		}
		// Check for WAV
		else if (audioBuffer.toString('ascii', 0, 4) === 'RIFF') {
			detectedFormat = 'WAV';
			actualMimetype = 'audio/wav';
			fileExtension = 'wav';
		}
		else {
			// Default to M4A since that's what the signature often suggests
			actualMimetype = 'audio/mp4';
			fileExtension = 'm4a';
			detectedFormat = 'Unknown (defaulting to M4A)';
		}

		// Convert to MP3 if not already MP3
		let finalBuffer = audioBuffer;
		let finalMimetype = 'audio/mpeg';
		let finalExtension = 'mp3';

		if (fileExtension !== 'mp3') {
			try {
				finalBuffer = await toAudio(audioBuffer, fileExtension);
				if (!finalBuffer || finalBuffer.length === 0) {
					throw new Error('Conversion returned empty buffer');
				}
				finalMimetype = 'audio/mpeg';
				finalExtension = 'mp3';
			} catch (convErr) {
				throw new Error(`Failed to convert ${detectedFormat} to MP3: ${convErr.message}`);
			}
		}

		// Send buffer as MP3
		await sock.sendMessage(chatId, {
			audio: finalBuffer,
			mimetype: finalMimetype,
			fileName: `${(audioData.title || video.title || 'song').replace(/[^\w\s-]/g, '')}.${finalExtension}`,
			ptt: false
		}, { quoted: message });

		// Cleanup: Delete temp files created during conversion
		try {
			const tempDir = path.join(__dirname, '../temp');
			if (fs.existsSync(tempDir)) {
				const files = fs.readdirSync(tempDir);
				const now = Date.now();
				files.forEach(file => {
					const filePath = path.join(tempDir, file);
					try {
						const stats = fs.statSync(filePath);
						// Delete temp files older than 10 seconds (conversion temp files)
						if (now - stats.mtimeMs > 10000) {
							// Check if it's a temp audio file (mp3, m4a, or numeric timestamp files from converter)
							if (file.endsWith('.mp3') || file.endsWith('.m4a') || /^\d+\.(mp3|m4a)$/.test(file)) {
								fs.unlinkSync(filePath);
							}
						}
					} catch (e) {
						// Ignore individual file errors
					}
				});
			}
		} catch (cleanupErr) {
			// Ignore cleanup errors
		}

    } catch (err) {
        console.error('Song command error:', err);
        
        // Provide more specific error messages
        let errorMessage = '❌ Failed to download song.';
        if (err.message && err.message.includes('blocked')) {
            errorMessage = '❌ Download blocked. The content may be unavailable in your region or due to legal restrictions.';
        } else if (err.response?.status === 451 || err.status === 451) {
            errorMessage = '❌ Content unavailable (451). This may be due to legal restrictions or regional blocking.';
        } else if (err.message && err.message.includes('All download sources failed')) {
            errorMessage = '❌ All download sources failed. The content may be unavailable or blocked.';
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: message });
    }
}

module.exports = songCommand;