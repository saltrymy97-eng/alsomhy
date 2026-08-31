// db.js - وس الوسيط لقاعدة البيانات في بيئة Electron / Desktop

const checkElectron = () => 
  typeof window !== 'undefined' && 
  ((window.api && window.api.dbQuery) || (window.electronAPI && window.electronAPI.query));

// دالة وسيطة للتعامل مع اختلاف مسميات الجسر بين window.api و window.electronAPI
const dbQueryBridge = async (sql, params = []) => {
  if (window.api && typeof window.api.dbQuery === 'function') {
    return await window.api.dbQuery(sql, params);
  }
  if (window.electronAPI && typeof window.electronAPI.query === 'function') {
    return await window.electronAPI.query(sql, params);
  }
  return null;
};

const db = {
  // 1. الدالة الأساسية التي تنتظرها الشاشات (DailyLogScreen وغيرها)
  query: async (sql, params = []) => {
    if (!checkElectron()) return [];
    try {
      return await dbQueryBridge(sql, params);
    } catch (e) {
      console.error("خطأ في تنفيذ query:", e);
      throw e;
    }
  },

  // 2. تنفيذ الأوامر الهيكلية
  exec: async (queryStr) => {
    if (!checkElectron()) return null;
    try {
      return await dbQueryBridge(queryStr, []);
    } catch (e) {
      console.error("خطأ في exec:", e);
      throw e;
    }
  },

  // 3. تنفيذ عمليات الإضافة والتعديل والحذف
  run: async (queryStr, params = []) => {
    if (!checkElectron()) return { lastInsertRowId: 0, changes: 0 };
    try {
      return await dbQueryBridge(queryStr, params);
    } catch (e) {
      console.error("خطأ في run:", e);
      return { lastInsertRowId: 0, changes: 0 };
    }
  },

  // 4. قراءة البيانات
  getAll: async (queryStr, params = []) => {
    if (!checkElectron()) return [];
    try {
      const result = await dbQueryBridge(queryStr, params);
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error("خطأ في getAll:", e);
      return [];
    }
  },

  // التوافقية السابقة
  execSync: async (queryStr) => await db.exec(queryStr),
  runSync: async (queryStr, params = []) => await db.run(queryStr, params),
  getAllSync: async (queryStr, params = []) => await db.getAll(queryStr, params)
};

// تهيئة الجداول الخمسة عند تشغيل التطبيق
export const initDB = async () => {
  if (!checkElectron()) {
    console.log("تم تخطي تهيئة قاعدة البيانات لأن التطبيق يعمل خارج بيئة Electron.");
    return false;
  }

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS daily_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        total_purchases REAL DEFAULT 0,
        total_sales REAL DEFAULT 0,
        net_profit REAL DEFAULT 0
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        quantity INTEGER DEFAULT 0,
        expiry_date TEXT,
        min_alert_quantity INTEGER DEFAULT 0
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS treasury (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_type TEXT NOT NULL, 
        transaction_type TEXT NOT NULL, 
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS contacts_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_type TEXT NOT NULL, 
        amount_due REAL DEFAULT 0,
        due_date TEXT NOT NULL, 
        status TEXT DEFAULT 'pending' 
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL
      );
    `);

    console.log("تم إنشاء جميع الجداول الخمسة بنجاح داخل قاعدة بيانات Electron المحلية!");
    return true;
  } catch (error) {
    console.error("حدث خطأ أثناء إنشاء الجداول: ", error);
    return false;
  }
};

export const query = db.query;
export default db;
