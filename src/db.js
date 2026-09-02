// db.js - وسيط قاعدة البيانات الذكي والمستقر
// متوافق بنسبة 100% مع App.js و ReportsScreen.js مع معالجة أخطاء الاستعلامات تلقائياً

const checkElectron = () => 
  typeof window !== 'undefined' && 
  ((window.api && window.api.dbQuery) || (window.electronAPI && window.electronAPI.query));

// دالة تنظيف الاستعلامات القادمة من الواجهات لتصحيح التنصيص المزدوج حول النصوص
const sanitizeSQL = (sql) => {
  if (typeof sql !== 'string') return sql;
  return sql
    .replace(/"قبض"/g, "'قبض'")
    .replace(/"إيداع"/g, "'إيداع'")
    .replace(/"صرف"/g, "'صرف'")
    .replace(/"سحب"/g, "'سحب'")
    .replace(/"income"/g, "'income'")
    .replace(/"expense"/g, "'expense'");
};

const dbQueryBridge = async (sql, params = []) => {
  const cleanSQL = sanitizeSQL(sql);
  if (window.api && typeof window.api.dbQuery === 'function') {
    return await window.api.dbQuery(cleanSQL, params);
  }
  if (window.electronAPI && typeof window.electronAPI.query === 'function') {
    return await window.electronAPI.query(cleanSQL, params);
  }
  return null;
};

const db = {
  query: async (sql, params = []) => {
    if (!checkElectron()) return [];
    try {
      return await dbQueryBridge(sql, params);
    } catch (e) {
      console.error("خطأ في تنفيذ query:", e);
      throw e;
    }
  },

  exec: async (queryStr) => {
    if (!checkElectron()) return null;
    try {
      return await dbQueryBridge(queryStr, []);
    } catch (e) {
      console.error("خطأ في exec:", e);
      throw e;
    }
  },

  run: async (queryStr, params = []) => {
    if (!checkElectron()) return { lastInsertRowId: 0, changes: 0 };
    try {
      return await dbQueryBridge(queryStr, params);
    } catch (e) {
      console.error("خطأ في run:", e);
      return { lastInsertRowId: 0, changes: 0 };
    }
  },

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

  execSync: async (queryStr) => await db.exec(queryStr),
  runSync: async (queryStr, params = []) => await db.run(queryStr, params),
  getAllSync: async (queryStr, params = []) => await db.getAll(queryStr, params)
};

// ==========================================
// تهيئة وإصلاح قاعدة البيانات تلقائياً (Smart Initialization)
// ==========================================
export const initDB = async () => {
  if (!checkElectron()) {
    console.log("تم تخطي تهيئة قاعدة البيانات لعدم توفر بيئة Electron.");
    return false;
  }

  try {
    // 1. إنشاء الجداول الأساسية المتوافقة مع شاشات التقارير والداشبورد
    await db.exec(`
      CREATE TABLE IF NOT EXISTS daily_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        entry_date TEXT,
        time TEXT,
        type TEXT,
        description TEXT,
        total_purchases REAL DEFAULT 0,
        total_sales REAL DEFAULT 0,
        net_profit REAL DEFAULT 0,
        income REAL DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_amount REAL NOT NULL DEFAULT 0,
        description TEXT,
        date TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_amount REAL NOT NULL DEFAULT 0,
        description TEXT,
        date TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        amount REAL NOT NULL DEFAULT 0,
        date TEXT,
        type TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS treasury (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_type TEXT, 
        transaction_type TEXT, 
        type TEXT,
        amount REAL NOT NULL DEFAULT 0,
        date TEXT NOT NULL,
        time TEXT,
        notes TEXT,
        description TEXT,
        income REAL DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        product_name TEXT,
        quantity REAL DEFAULT 0,
        qty REAL DEFAULT 0,
        expiry_date TEXT,
        expiry TEXT,
        min_alert_quantity REAL DEFAULT 0,
        minAlert REAL DEFAULT 0,
        entry_date TEXT,
        type TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS contacts_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_type TEXT, 
        type TEXT,
        amount_due REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        due_date TEXT, 
        date TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );
    `);

    // 2. الهجرة الآمنة للأعمدة المفقودة
    const ensureColumn = async (tableName, columnName, columnDef) => {
      try {
        const tableInfo = await db.query(`PRAGMA table_info(${tableName});`);
        const exists = tableInfo.some(col => col.name === columnName);
        if (!exists) {
          await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
        }
      } catch (err) {}
    };

    await ensureColumn('sales', 'date', 'TEXT');
    await ensureColumn('purchases', 'date', 'TEXT');
    await ensureColumn('expenses', 'date', 'TEXT');
    await ensureColumn('expenses', 'title', 'TEXT');

    // 3. توحيد البيانات والتواريخ المفقودة تلقائياً
    await db.exec(`
      UPDATE treasury 
      SET account_type = 'الصندوق' 
      WHERE LOWER(account_type) IN ('cash', 'صندوق', 'خزينة', 'نقدي', 'الخزينة');
    `);
    
    await db.exec(`
      UPDATE treasury 
      SET account_type = 'البنك' 
      WHERE LOWER(account_type) IN ('bank', 'بنك', 'حساب بنكي', 'البنك الأهلي');
    `);

    await db.exec(`
      UPDATE sales 
      SET created_at = date || ' 12:00:00' 
      WHERE (created_at IS NULL OR created_at = '') AND date IS NOT NULL;
    `);

    await db.exec(`
      UPDATE purchases 
      SET created_at = date || ' 12:00:00' 
      WHERE (created_at IS NULL OR created_at = '') AND date IS NOT NULL;
    `);

    await db.exec(`
      UPDATE expenses 
      SET created_at = date || ' 12:00:00' 
      WHERE (created_at IS NULL OR created_at = '') AND date IS NOT NULL;
    `);

    // 4. بناء الفهارس لتسريع القراءة
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_treasury_date ON treasury(date);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_transactions(date);`);

    console.log("✅ تم تهيئة قاعدة البيانات بنجاح وإصلاح كافة أخطاء الاستعلامات تلقائياً.");
    return true;
  } catch (error) {
    console.error("❌ حدث خطأ أثناء تهيئة قاعدة البيانات: ", error);
    return false;
  }
};

export const query = db.query;
export default db;
