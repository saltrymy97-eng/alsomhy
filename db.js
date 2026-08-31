// db.js - وسيط قاعدة البيانات لبيئة Electron / Desktop
// تم حذف expo-sqlite تماماً لمنع أخطاء t.join is not a function

// فحص ما إذا كان التطبيق يعمل داخل بيئة Electron وعبر الجسر الآمن
const checkElectron = () => typeof window !== 'undefined' && window.api && window.api.dbQuery;

// كائن آمن يغلف دوال قاعدة البيانات لإرسال الاستعلامات إلى Main Process
const db = {
  // تنفيذ أوامر إنشاء الجداول والأوامر الهيكلية
  exec: async (query) => {
    if (!checkElectron()) {
      console.warn("تنبيه: التطبيق يعمل خارج بيئة Electron.");
      return null;
    }
    try {
      return await window.api.dbQuery(query, []);
    } catch (e) {
      console.error("خطأ في exec:", e);
      throw e;
    }
  },

  // تنفيذ عمليات الإضافة والتعديل والحذف (INSERT, UPDATE, DELETE)
  run: async (query, params = []) => {
    if (!checkElectron()) {
      return { lastInsertRowId: 0, changes: 0 };
    }
    try {
      return await window.api.dbQuery(query, params);
    } catch (e) {
      console.error("خطأ في run:", e);
      return { lastInsertRowId: 0, changes: 0 };
    }
  },

  // قراءة واسترجاع البيانات (SELECT)
  getAll: async (query, params = []) => {
    if (!checkElectron()) {
      return [];
    }
    try {
      const result = await window.api.dbQuery(query, params);
      return Array.isArray(result) ? result : [];
    } catch (e) {
      console.error("خطأ في getAll:", e);
      return [];
    }
  },

  // أسماء التوافق السابقة (مع تحويلها لـ async لضمان عدم تجميد واجهة الديسكتوب)
  execSync: async (query) => await db.exec(query),
  runSync: async (query, params = []) => await db.run(query, params),
  getAllSync: async (query, params = []) => await db.getAll(query, params)
};

// دالة تهيئة الجداول الخمسة عند تشغيل التطبيق
export const initDB = async () => {
  if (!checkElectron()) {
    console.log("تم تخطي تهيئة قاعدة البيانات لأن التطبيق يعمل خارج بيئة Electron.");
    return false;
  }

  try {
    // 1. جدول السجل اليومي (المبيعات، المشتريات، الصافي)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS daily_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        total_purchases REAL DEFAULT 0,
        total_sales REAL DEFAULT 0,
        net_profit REAL DEFAULT 0
      );
    `);

    // 2. جدول المخزون والتنبيهات (لمراقبة الصلاحية والنواقص)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        quantity INTEGER DEFAULT 0,
        expiry_date TEXT,
        min_alert_quantity INTEGER DEFAULT 0
      );
    `);

    // 3. جدول النقدية (الصندوق والبنك)
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

    // 4. جدول العملاء والموردين (الديون والاستحقاقات)
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

    // 5. جدول المصروفات التشغيلية
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

export default db;
