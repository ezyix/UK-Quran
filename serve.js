const http = require('http');
const fs = require('fs');
const path = require('path');
const port = 8000;
const root = process.cwd();
http.createServer((req, res) => {
  const safeUrl = decodeURI(req.url).split('?')[0].split('#')[0];
  const safe = path.normalize(safeUrl).replace(/^([\.]{2}[\/\\])+/g, '');
  let filePath = path.join(root, safe);
  if (filePath.endsWith(path.sep)) filePath = path.join(filePath, 'index.html');
  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.statusCode = 404;
      res.end('404 Not Found');
      return;
    }
    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fs.stat(filePath, (e, s) => {
        if (e || !s.isFile()) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        fs.createReadStream(filePath).pipe(res);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.oga': 'audio/ogg',
      '.webm': 'video/webm'
    };
    res.setHeader('Content-Type', map[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(port, () => console.log(`Server started on http://localhost:${port}`));
