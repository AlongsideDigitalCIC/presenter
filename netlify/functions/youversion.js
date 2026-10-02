export async function handler(event, context) {
  const apiKey = (process.env.YOUVERSION_API_KEY || '').trim();
  
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'YOUVERSION_API_KEY is not configured on the server.' })
    };
  }

  const { endpoint, ...otherQuery } = event.queryStringParameters || {};
  
  if (!endpoint) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing endpoint query parameter' })
    };
  }
  
  // Reconstruct query params to pass along to YouVersion
  const qs = new URLSearchParams(otherQuery).toString();
  const url = `https://api.youversion.com/v1${endpoint}${qs ? '?' + qs : ''}`;

  try {
    const res = await fetch(url, {
      headers: {
        'X-YVP-App-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    const data = await res.text();
    
    return {
      statusCode: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: data
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
