// db.js - وسيط قاعدة البيانات لبيئة Electron / Desktop مع دعم التجميع والتقارير الشهرية

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
  getAllSync: async (queryStr, params = []) => await db.getAll(queryStr, params),

  // ==========================================
  // 5. دوال الاستعلام والفلترة الشهرية المضافة
  // ==========================================

  // جلب حركات اليومية لشهر معين (المبيعات، المشتريات، الصافي)
  getMonthlyDailyLog: async (monthStr) => { // الصيغة المطلوبة: YYYY-MM
    return await db.query(
      `SELECT * FROM daily_transactions 
       WHERE strftime('%Y-%m', date) = ? 
       ORDER BY date DESC;`,
      [monthStr]
    );
  },

  // ملخص إحصائيات حركات اليومية لشهر معين
  getMonthlyDailySummary: async (monthStr) => {
    const res = await db.query(
      `SELECT 
         COALESCE(SUM(total_sales), 0) as totalSales, 
         COALESCE(SUM(total_purchases), 0) as totalPurchases, 
         COALESCE(SUM(net_profit), 0) as totalProfit 
       FROM daily_transactions 
       WHERE strftime('%Y-%m', date) = ?;`,
      [monthStr]
    );
    return res && res[0] ? res[0] : { totalSales: 0, totalPurchases: 0, totalProfit: 0 };
  },

  // جلب حركات النقدية (الصندوق والبنك) لشهر معين
  getMonthlyTreasury: async (monthStr) => {
    return await db.query(
      `SELECT * FROM treasury 
       WHERE strftime('%Y-%m', date) = ? 
       ORDER BY date DESC;`,
      [monthStr]
    );
  },

  // ملخص حركة النقدية لشهر معين (إجمالي المقبوضات وإجمالي المدفوعات)
  getMonthlyTreasurySummary: async (monthStr) => {
    const res = await db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN transaction_type = 'income' OR transaction_type = 'قبض' THEN amount ELSE 0 END), 0) as totalIncome,
         COALESCE(SUM(CASE WHEN transaction_type = 'expense' OR transaction_type = 'صرف' THEN amount ELSE 0 END), 0) as totalOutcome
       FROM treasury 
       WHERE strftime('%Y-%m', date) = ?;`,
      [monthStr]
    );
    return res && res[0] ? res[0] : { totalIncome: 0, totalOutcome: 0 };
  },

  // جلب المصروفات التشغيلية لشهر معين مع الإجمالي
  getMonthlyExpenses: async (monthStr) => {
    const list = await db.query(
      `SELECT * FROM expenses 
       WHERE strftime('%Y-%m', date) = ? 
       ORDER BY date DESC;`,
      [monthStr]
    );
    const summary = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as totalExpenses 
       FROM expenses 
       WHERE strftime('%Y-%m', date) = ?;`,
      [monthStr]
    );
    return {
      list: list || [],
      totalExpenses: summary && summary[0] ? summary[0].totalExpenses : 0
    };
  },

  // ملخص التقارير المالية المجمعة لشهر معين
  getMonthlyComprehensiveReport: async (monthStr) => {
    const dailySummary = await db.getMonthlyDailySummary(monthStr);
    const treasurySummary = await db.getMonthlyTreasurySummary(monthStr);
    const expensesSummary = await db.getMonthlyExpenses(monthStr);

    const netFinalIncome = dailySummary.totalProfit - expensesSummary.totalExpenses;

    return {
      month: monthStr,
      totalSales: dailySummary.totalSales,
      totalPurchases: dailySummary.totalPurchases,
      grossProfit: dailySummary.totalProfit,
      totalExpenses: expensesSummary.totalExpenses,
      netFinalIncome: netFinalIncome,
      treasuryIncome: treasurySummary.totalIncome,
      treasuryOutcome: treasurySummary.totalOutcome
    };
  }
};

// تهيئة الجداول الخمسة والفهارس عند تشغيل التطبيق
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

    // 2. جدول المخزون والتنبيهات
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

    // 6. إنشاء الفهارس (Indexes) لسرعة استعلام الأشهر والسنوات
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_transactions(date);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_treasury_date ON treasury(date);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_due ON contacts_ledger(due_date);`);

    console.log("تم إنشاء جميع الجداول والفهارس بنجاح داخل قاعدة بيانات Electron المحلية!");
    return true;
  } catch (error) {
    console.error("حدث خطأ أثناء إنشاء الجداول: ", error);
    return false;
  }
};

export const query = db.query;
export default db;
