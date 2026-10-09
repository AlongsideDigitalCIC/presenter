const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:5179');
ws.on('open', () => ws.send(JSON.stringify({type: 'request_state'})));
ws.on('message', data => { 
  if (data instanceof Buffer) {
    // maybe try to parse it as json just in case it's a buffer of text
    try {
      console.log(data.toString());
    } catch(e) {}
    return;
  }
  console.log(data.toString()); 
  ws.close(); 
});
ws.on('error', err => console.log('error', err));
