import axios from 'axios';
import { load as cheerioLoad } from 'cheerio';
const cheerio = { load: cheerioLoad };

async function pinterest(query) {
  const term = String(query || '').trim();
  if (!term) return [];
  const { data } = await axios.get(
    `https://id.pinterest.com/search/pins/?q=${encodeURIComponent(term)}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000,
      maxRedirects: 5
    }
  );
  const $ = cheerio.load(data);
  const results = [];
  $('img[src], img[data-src]').each((_, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src');
    if (src && /^https?:\/\/(?:i\.)?pinimg\.com\//i.test(src)) {
      results.push(src.replace(/\/236x\//, '/736x/'));
    }
  });
  return [...new Set(results)].slice(0, 30);
}

async function wallpaper(title, page = '1') {
  const { data } = await axios.get(
    `https://www.besthdwallpaper.com/search?CurrentPage=${page}&q=${encodeURIComponent(title)}`,
    { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" } }
  );
  const $ = cheerio.load(data);
  const fetchedresult = [];
  $('div.grid-item').each(function (a, b) {
    fetchedresult.push({
      title: $(b).find('div.info > a > h3').text(),
      type: $(b).find('div.info > a:nth-child(2)').text(),
      source:
        'https://www.besthdwallpaper.com/' +
        $(b).find('div > a:nth-child(3)').attr('href'),
      image: [
        $(b).find('picture > img').attr('data-src') ||
          $(b).find('picture > img').attr('src'),
        $(b).find('picture > source:nth-child(1)').attr('srcset'),
        $(b).find('picture > source:nth-child(2)').attr('srcset'),
      ],
    });
  });
  return fetchedresult;
}

async function wikimedia(title) {
  const res = await axios.get(
    `https://commons.wikimedia.org/w/index.php?search=${title}&title=Special:MediaSearch&go=Go&type=image`
  );
  const $ = cheerio.load(res.data);
  const fetchedresult = [];
  $('.sdms-search-results__list-wrapper > div > a').each(function (a, b) {
    fetchedresult.push({
      title: $(b).find('img').attr('alt'),
      source: $(b).attr('href'),
      image:
        $(b).find('img').attr('data-src') || $(b).find('img').attr('src'),
    });
  });
  return fetchedresult;
}

async function quotesAnime() {
  const page = Math.floor(Math.random() * 184);
  const { data } = await axios.get(
    'https://otakotaku.com/quote/feed/' + page
  );
  const $ = cheerio.load(data);
  const fetchedresult = [];
  $('div.kotodama-list').each(function (l, h) {
    fetchedresult.push({
      link: $(h).find('a').attr('href'),
      gambar: $(h).find('img').attr('data-src'),
      karakter: $(h).find('div.char-name').text().trim(),
      anime: $(h).find('div.anime-title').text().trim(),
      episode: $(h).find('div.meta').text(),
      up_at: $(h).find('small.meta').text(),
      quotes: $(h).find('div.quote').text().trim(),
    });
  });
  return fetchedresult;
}

async function aiovideodl(link) {
  const src = await axios({
    url: 'https://aiovideodl.ml/',
    method: 'GET',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      cookie:
        'PHPSESSID=69ce1f8034b1567b99297eee2396c308; _ga=GA1.2.1360894709.1632723147; _gid=GA1.2.1782417082.1635161653',
    },
  });
  const a = cheerio.load(src.data);
  const token = a('#token').attr('value');
  const { data } = await axios({
    url: 'https://aiovideodl.ml/wp-json/aio-dl/video-data/',
    method: 'POST',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      cookie:
        'PHPSESSID=69ce1f8034b1567b99297eee2396c308; _ga=GA1.2.1360894709.1632723147; _gid=GA1.2.1782417082.1635161653',
    },
    data: new URLSearchParams(Object.entries({ url: link, token: token })),
  });
  return data;
}

async function umma(url) {
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  const image = [];
  $('#article-content > div')
    .find('img')
    .each(function (a, b) {
      image.push($(b).attr('src'));
    });
  return {
    title: $('#wrap > div.content-container.font-6-16 > h1').text().trim(),
    author: {
      name: $(
        '#wrap > div.content-container.font-6-16 > div.content-top > div > div.user-ame.font-6-16.fw'
      )
        .text()
        .trim(),
      profilePic: $(
        '#wrap > div.content-container.font-6-16 > div.content-top > div > div.profile-photo > img.photo'
      ).attr('src'),
    },
    caption: $('#article-content > div > p').text().trim(),
    media: $('#article-content > div > iframe').attr('src')
      ? [$('#article-content > div > iframe').attr('src')]
      : image,
    type: $('#article-content > div > iframe').attr('src') ? 'video' : 'image',
    like: $(
      '#wrap > div.bottom-btns > div > button:nth-child(1) > div.text.font-6-12'
    ).text(),
  };
}

async function ringtone(title) {
  const { data } = await axios.get(
    'https://meloboom.com/en/search/' + title
  );
  const $ = cheerio.load(data);
  const fetchedresult = [];
  $(
    '#__next > main > section > div.jsx-2244708474.container > div > div > div > div:nth-child(4) > div > div > div > ul > li'
  ).each(function (a, b) {
    fetchedresult.push({
      title: $(b).find('h4').text(),
      source: 'https://meloboom.com/' + $(b).find('a').attr('href'),
      audio: $(b).find('audio').attr('src'),
    });
  });
  return fetchedresult;
}

async function styletext(teks) {
  const { data } = await axios.get(
    'http://qaz.wtf/u/convert.cgi?text=' + teks
  );
  const $ = cheerio.load(data);
  const fetchedresult = [];
  $('table > tbody > tr').each(function (a, b) {
    fetchedresult.push({
      name: $(b).find('td:nth-child(1) > span').text(),
      result: $(b).find('td:nth-child(2)').text().trim(),
    });
  });
  return fetchedresult;
}

export { pinterest, wallpaper, wikimedia, quotesAnime, aiovideodl, umma, ringtone, styletext };
export default { pinterest, wallpaper, wikimedia, quotesAnime, aiovideodl, umma, ringtone, styletext };
