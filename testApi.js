const { getToken } = require('./getToken');

getToken().then(async token => {
  const res = await fetch('https://lms-api.mindx.vn/', {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'accept-language': 'vi,en;q=0.9',
      'authorization': token,
      'cache-control': 'no-cache',
      'content-language': 'vi',
      'content-type': 'application/json',
      'origin': 'https://lms.mindx.edu.vn',
      'pragma': 'no-cache',
      'priority': 'u=1, i',
      'referer': 'https://lms.mindx.edu.vn/',
      'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({
      operationName: 'FindTicketPaginate',
      query: `query FindTicketPaginate($payload: TicketQuery) {
        findTicketPaginate(payload: $payload) {
          pagination { total }
        }
      }`,
      variables: {
        payload: {
          pageIndex: 0,
          itemsPerPage: 1,
          centreId_in: ['62d6dc936e356729147d7399'],
          status_in: [],
          channel_in: [],
          filter_textSearch: '',
          createdAt_gte: '2026-02-01T00:00:00.000Z',
          createdAt_lte: '2026-02-28T23:59:59.000Z'
        }
      }
    })
  });

  console.log('HTTP Status:', res.status);
  const body = await res.text();
  console.log('Response:', body.slice(0, 500));
}).catch(err => {
  console.error('Error:', err.message);
});
