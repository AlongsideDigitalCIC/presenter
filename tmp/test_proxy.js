const https = require('https');

const query = encodeURIComponent('amazing grace');
const url = `https://songselect.ccli.com/search/results?searchterm=${query}`;

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

https.get(url, options, (res) => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Body length:', body.length);
    console.log('Snippet:', body.substring(0, 500));
  });
}).on('error', (e) => {
  console.error(e);
});
