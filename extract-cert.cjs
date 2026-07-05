const fs = require('fs');
const jks = require('jks-js');

const buf = fs.readFileSync('./@zhetazioas__app-taxis.jks');

const keystore = jks.toPem(buf, 'f8cb6d9f1d7cbdf68370f5f96afc7044', '93ad499958112a607d49529890134453');

const alias = '59703f4d387e1bac6490e964454d5db4';
const entry = keystore[alias];
console.log('Type:', typeof entry);
console.log('Keys:', Array.isArray(entry) ? 'array' : Object.keys(entry));
console.log(JSON.stringify(Object.keys(entry), null, 2));

if (typeof entry === 'string') {
  fs.writeFileSync('./upload-key.pem', entry);
  console.log(entry);
} else if (entry && entry.cert) {
  fs.writeFileSync('./upload-key.pem', entry.cert);
  console.log('cert:', entry.cert);
} else {
  console.log(JSON.stringify(entry, null, 2));
}
