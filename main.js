const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// استيراد مكتبة قاعدة البيانات للديسكتوب
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.log("لم يتم العثور على better-sqlite3، جاري التحقق من التوافقية...");
}

const PORT = 34567;
let server = null;
let db = null;

// ==========================================
// 1. إدارة قاعدة البيانات المحلية (SQLite)
// ==========================================
function initDatabaseConnection() {
  try {
    // تحديد مسار آمن لملف قاعدة البيانات داخل مجلد بيانات تطبيق المستخدم
    const dbPath = path.join(app.getPath('userData'), 'accounting.db');
    console.log("مسار قاعدة البيانات المحلي:", dbPath);

    if (Database) {
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL'); // تسريع عمليات الكتابة والقراءة
    }
  } catch (error) {
    console.error("خطأ في فتح قاعدة البيانات في Main Process:", error);
  }
}

// مستمع استقبال الاستعلامات من الواجهة (db.js)
ipcMain.handle('db-query', async (event, arg1, arg2) => {
  if (!db) return [];

  // دعم الاستدعاء بالصيغتين {sql, params} أو (sql, params)
  let sql = typeof arg1 === 'object' ? arg1.sql : arg1;
  let params = typeof arg1 === 'object' ? arg1.params : arg2;
  params = params || [];

  try {
    const trimmedSql = sql.trim().toUpperCase();
    
    // إذا كان الاستعلام قراءة (SELECT)
    if (trimmedSql.startsWith('SELECT') || trimmedSql.startsWith('PRAGMA')) {
      const stmt = db.prepare(sql);
      return stmt.all(params);
    } 
    // إذا كان الاستعلام تعديل/إضافة/حذف (INSERT, UPDATE, DELETE, CREATE)
    else {
      const stmt = db.prepare(sql);
      const info = stmt.run(params);
      return { lastInsertRowId: info.lastInsertRowid, changes: info.changes };
    }
  } catch (error) {
    console.error("خطأ أثناء تنفيذ SQL في main.js:", error);
    throw error;
  }
});

// مستمع تهيئة قاعدة البيانات
ipcMain.handle('db-init', async () => {
  return { success: true };
});


// ==========================================
// 2. إعداد الخادم المحلي لتشغيل الويب
// ==========================================
function startServer() {
  const distDir = path.join(__dirname, 'dist');
  
  server = http.createServer((req, res) => {
    // 1. فصل مسار الطلب عن معاملات الاستعلام
    const requestPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const filePath = path.normalize(path.join(distDir, requestPath));
   
    // 2. حماية الخادم من ثغرات Path Traversal
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // 3. قراءة الملف المطلوب
    fs.readFile(filePath, (err, data) => {
      if (err) {
        // دعم تطبيقات SPA بتوجيه أخطاء 404 إلى index.html
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

      // 4. تحديد نوع المحتوى MIME Type
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
        '.wasm': 'application/wasm'
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
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL(`http://127.0.0.1:${port}`);
}

// تهيئة قاعدة البيانات والتطبيق عند الجاهزية
app.whenReady().then(() => {
  initDatabaseConnection();
  startServer();
});

// إغلاق الخادم والتطبيق عند إغلاق النوافذ
app.on('window-all-closed', () => {
  if (db && db.close) db.close();
  if (server) server.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
