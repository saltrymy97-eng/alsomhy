// db.js - وسيط قاعدة البيانات لبيئة Electron / Desktop مع دعم التجميع والتقارير الشهرية

const checkElectron = () => 
  typeof window !== 'undefined' && 
  ((window.api && window.api.dbQuery) || (window.electronAPI && window.electronAPI.query));

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
  getAllSync: async (queryStr, params = []) => await db.getAll(queryStr, params),

  // ==========================================
  // دوال الاستعلام والفلترة الشهرية
  // ==========================================

  getMonthlyDailyLog: async (monthStr) => {
    return await db.query(
      `SELECT * FROM daily_transactions WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC;`,
      [monthStr]
    );
  },

  getMonthlyDailySummary: async (monthStr) => {
    const res = await db.query(
      `SELECT 
         COALESCE(SUM(total_sales), 0) as totalSales, 
         COALESCE(SUM(total_purchases), 0) as totalPurchases, 
         COALESCE(SUM(net_profit), 0) as totalProfit 
       FROM daily_transactions WHERE strftime('%Y-%m', date) = ?;`,
      [monthStr]
    );
    return res && res[0] ? res[0] : { totalSales: 0, totalPurchases: 0, totalProfit: 0 };
  },

  getMonthlyTreasury: async (monthStr) => {
    return await db.query(
      `SELECT * FROM treasury WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC;`,
      [monthStr]
    );
  },

  getMonthlyTreasurySummary: async (monthStr) => {
    const res = await db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN transaction_type = 'income' OR transaction_type = 'قبض' THEN amount ELSE 0 END), 0) as totalIncome,
         COALESCE(SUM(CASE WHEN transaction_type = 'expense' OR transaction_type = 'صرف' THEN amount ELSE 0 END), 0) as totalOutcome
       FROM treasury WHERE strftime('%Y-%m', date) = ?;`,
      [monthStr]
    );
    return res && res[0] ? res[0] : { totalIncome: 0, totalOutcome: 0 };
  },

  getMonthlyExpenses: async (monthStr) => {
    const list = await db.query(
      `SELECT * FROM expenses WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC;`,
      [monthStr]
    );
    const summary = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses WHERE strftime('%Y-%m', date) = ?;`,
      [monthStr]
    );
    return {
      list: list || [],
      totalExpenses: summary && summary[0] ? summary[0].totalExpenses : 0
    };
  },

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

// تهيئة الجداول وتصحيح الأعمدة الناقصة تلقائياً (تجنب أخطاء no such column)
export const initDB = async () => {
  if (!checkElectron()) {
    console.log("تم تخطي تهيئة قاعدة البيانات.");
    return false;
  }

  try {
    // 1. جدول السجل اليومي 
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. جدول المبيعات المستقل 
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_amount REAL NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. جدول المشتريات المستقل 
    await db.exec(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_amount REAL NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. جدول المخزون 
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. جدول النقدية والخزينة
    await db.exec(`
      CREATE TABLE IF NOT EXISTS treasury (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_type TEXT, 
        transaction_type TEXT, 
        type TEXT,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        time TEXT,
        notes TEXT,
        description TEXT,
        income REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. جدول العملاء والموردين 
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. جدول المصروفات
    await db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        type TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- آلية أمان إضافية (Migration): التأكد من إضافة أي عمود قديم غير موجود في الجداول الحالية ---
    const tablesToCheck = ['daily_transactions', 'sales', 'purchases', 'inventory', 'treasury', 'contacts_ledger', 'expenses'];
    
    // إضافة الأعمدة الحرجة إن لم تكن موجودة لتفادي أخطاء SQLite تماماً
    const ensureColumn = async (tableName, columnName, columnDef) => {
      try {
        const tableInfo = await db.query(`PRAGMA table_info(${tableName});`);
        const exists = tableInfo.some(col => col.name === columnName);
        if (!exists) {
          await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
        }
      } catch (err) {
        // تجاهل الخطأ في حال دعم الجدول مسبقاً
      }
    };

    // إضافة عمود الدخل (income) لتفادي الأخطاء في الداشبورد والتقارير
    await ensureColumn('daily_transactions', 'income', 'REAL DEFAULT 0');
    await ensureColumn('treasury', 'income', 'REAL DEFAULT 0');

    await ensureColumn('daily_transactions', 'entry_date', 'TEXT');
    await ensureColumn('daily_transactions', 'date', 'TEXT');
    await ensureColumn('daily_transactions', 'description', 'TEXT');
    
    await ensureColumn('inventory', 'entry_date', 'TEXT');
    await ensureColumn('inventory', 'name', 'TEXT');
    await ensureColumn('inventory', 'product_name', 'TEXT');
    await ensureColumn('inventory', 'quantity', 'REAL DEFAULT 0');
    await ensureColumn('inventory', 'qty', 'REAL DEFAULT 0');
    await ensureColumn('inventory', 'min_alert_quantity', 'REAL DEFAULT 0');
    await ensureColumn('inventory', 'minAlert', 'REAL DEFAULT 0');
    await ensureColumn('inventory', 'expiry_date', 'TEXT');
    await ensureColumn('inventory', 'expiry', 'TEXT');

    await ensureColumn('contacts_ledger', 'due_date', 'TEXT');
    await ensureColumn('contacts_ledger', 'date', 'TEXT');
    await ensureColumn('contacts_ledger', 'amount_due', 'REAL DEFAULT 0');
    await ensureColumn('contacts_ledger', 'amount', 'REAL DEFAULT 0');
    await ensureColumn('contacts_ledger', 'type', 'TEXT');
    await ensureColumn('contacts_ledger', 'contact_type', 'TEXT');

    await ensureColumn('expenses', 'description', 'TEXT');
    await ensureColumn('expenses', 'title', 'TEXT');

    // إنشاء الفهارس لضمان السرعة
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_transactions(date);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_treasury_date ON treasury(date);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_due ON contacts_ledger(due_date);`);

    console.log("تم إنشاء جميع الجداول وتحديث الأعمدة بنجاح تام!");
    return true;
  } catch (error) {
    console.error("حدث خطأ أثناء إنشاء الجداول: ", error);
    return false;
  }
};

export const query = db.query;
export default db;
