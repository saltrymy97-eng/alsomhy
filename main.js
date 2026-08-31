const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = 34567;
let server = null;

function startServer() {
  const distDir = path.join(__dirname, 'dist');
  
  server = http.createServer((req, res) => {
    // 1. فصل مسار الطلب عن معاملات الاستعلام وتوجيه المسار الرئيسي
    const requestPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const filePath = path.normalize(path.join(distDir, requestPath));
   
    // 2. حماية الخادم من ثغرات (Path Traversal) لمنع الوصول لملفات خارج مجلد dist
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // 3. قراءة الملف المطلوب
    fs.readFile(filePath, (err, data) => {
      if (err) {
        // دعم تطبيقات الصفحة الواحدة (SPA) بتوجيه أخطاء 404 إلى index.html
        fs.readFile(path.join(distDir, 'index.html'), (err2, indexData) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexData);
          }
        });
        return;
      }

      // 4. استخراج امتداد الملف وتحديد نوع المحتوى (MIME Type)
      const ext = path.extname(filePath).toLowerCase();
      
      const mimeTypes = {
        '.html': 'text/html',
        '.js':   'application/javascript',
        '.css':  'text/css',
        '.json': 'application/json',
        '.png':  'image/png',
        '.jpg':  'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg':  'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2':'font/woff2',
        '.wasm': 'application/wasm' // أساسي جداً لتشغيل محرك قاعدة البيانات SQLite الحقيقي دون انهيار
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.on('error', (err) => {
    console.error('Server Error:', err);
  });

  // 5. تشغيل الخادم المحلي ثم فتح نافذة التطبيق
  server.listen(PORT, '127.0.0.1', () => {
    createWindow(PORT);
  });
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // ربط ملف الجسر الآمن
      nodeIntegration: false,    // تعطيل دمج Node في الواجهة لمنع الانهيار الأمني والتقني
      contextIsolation: true     // تفعيل العزل الأمني الإلزامي لتطبيقات Electron الحديثة
    }
  });

  // تحميل الرابط الخاص بالخادم المحلي
  win.loadURL(`http://127.0.0.1:${port}`);
}

// تهيئة التطبيق
app.whenReady().then(startServer);

// إغلاق الخادم والتطبيق عند إغلاق النوافذ
app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
