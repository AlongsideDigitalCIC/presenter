const fs = require('fs');
let c = fs.readFileSync('src/components/RemoteControl.jsx', 'utf8');
c = c.replace('className={`aspect-video rounded-xl flex items-center justify-center transition-all active:scale-95 border ${', 'className={`aspect-video rounded-xl flex items-center justify-center transition-all active:scale-95 border relative overflow-hidden ${');
fs.writeFileSync('src/components/RemoteControl.jsx', c);
