const https = require('https');

const query = `{
  Page(page: 1, perPage: 5) {
    media(type: ANIME, sort: TRENDING_DESC, status: RELEASING) {
      id
      title { romaji english }
      coverImage { large }
    }
  }
}`;

const body = JSON.stringify({ query });

const options = {
  hostname: 'graphql.anilist.co',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
req.on('error', e => console.error('ERROR:', e.message));
req.write(body);
req.end();
