const fs = require('fs');
['package.json', 'src-tauri/tauri.conf.json'].forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/"version": "0.1.20"/, '"version": "0.1.21"');
    fs.writeFileSync(f, content);
});
let cargo = fs.readFileSync('src-tauri/Cargo.toml', 'utf8');
cargo = cargo.replace(/version = "0.1.20"/, 'version = "0.1.21"');
fs.writeFileSync('src-tauri/Cargo.toml', cargo);
