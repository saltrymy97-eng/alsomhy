const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// تعريف آمن لـ __dirname لمنع أي خطأ تداخل في البيئات
const safeDirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

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
let dbPath = '';

// ==========================================
// 1. إدارة قاعدة البيانات المحلية (SQLite)
// ==========================================
function initDatabaseConnection() {
  try {
    dbPath = path.join(app.getPath('userData'), 'accounting.db');
    console.log("مسار قاعدة البيانات المحلي:", dbPath);

    if (Database) {
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
    }
  } catch (error) {
    console.error("خطأ في فتح قاعدة البيانات في Main Process:", error);
  }
}

// مستمع استقبال الاستعلامات من الواجهة (db.js)
ipcMain.handle('db-query', async (event, arg1, arg2) => {
  if (!db) return [];

  let sql = typeof arg1 === 'object' ? arg1.sql : arg1;
  let params = typeof arg1 === 'object' ? arg1.params : arg2;
  params = params || [];

  try {
    const stmt = db.prepare(sql);
    
    if (stmt.reader) {
      return stmt.all(params);
    } else {
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
// 2. وحدة النسخ الاحتياطي والاستعادة (Backup & Restore)
// ==========================================

// إنشاء نسخة احتياطية
ipcMain.handle('backup-database', async () => {
  try {
    const defaultName = `backup_accounting_${new Date().toISOString().split('T')[0]}.db`;
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'حفظ نسخة احتياطية من قاعدة البيانات',
      defaultPath: defaultName,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
    });

    if (canceled || !filePath) return { success: false, message: 'تم إلغاء العملية' };

    // تنفيذ إجراء النسخ الاحتياطي بأمان
    if (db && typeof db.backup === 'function') {
      await db.backup(filePath);
    } else {
      fs.copyFileSync(dbPath, filePath);
    }

    return { success: true, message: 'تم حفظ النسخة الاحتياطية بنجاح!' };
  } catch (error) {
    console.error('خطأ في إنشاء النسخة الاحتياطية:', error);
    return { success: false, message: 'فشل حفظ النسخة الاحتياطية: ' + error.message };
  }
});

// استعادة نسخة احتياطية
ipcMain.handle('restore-database', async () => {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'اختر ملف النسخة الاحتياطية لاستعادتها',
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) return { success: false, message: 'تم إلغاء العملية' };

    const selectedFilePath = filePaths[0];

    // إغلاق اتصال قاعدة البيانات الحالي لتمكين استبدال الملف
    if (db && db.close) {
      db.close();
    }

    // استبدال ملف قاعدة البيانات الحالي بالملف المختار
    fs.copyFileSync(selectedFilePath, dbPath);

    // إعادة فتح الاتصال بعد الاستعادة
    initDatabaseConnection();

    return { success: true, message: 'تمت استعادة قاعدة البيانات بنجاح!' };
  } catch (error) {
    console.error('خطأ في استعادة النسخة الاحتياطية:', error);
    initDatabaseConnection();
    return { success: false, message: 'فشلت عملية الاستعادة: ' + error.message };
  }
});

// ==========================================
// 3. إعداد الخادم المحلي لتشغيل الويب
// ==========================================
function startServer() {
  const buildDir = path.join(safeDirname, 'build');
  
  server = http.createServer((req, res) => {
    const requestPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const filePath = path.normalize(path.join(buildDir, requestPath));
   
    if (!filePath.startsWith(buildDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        fs.readFile(path.join(buildDir, 'index.html'), (err2, indexData) => {
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

  server.listen(PORT, '127.0.0.1', () => {
    createWindow(PORT);
  });
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(safeDirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(() => {
  initDatabaseConnection();
  startServer();
});

app.on('window-all-closed', () => {
  if (db && db.close) db.close();
  if (server) server.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
