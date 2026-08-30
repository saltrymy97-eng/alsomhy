import * as SQLite from 'expo-sqlite';

// فتح قاعدة البيانات باستخدام الواجهة المتزامنة الحديثة والمتوافقة مع الويب
const db = SQLite.openDatabaseSync('accounting.db');

export const initDB = () => {
  try {
    // 1. جدول السجل اليومي (المبيعات، المشتريات، الصافي)
    db.execSync(`
      CREATE TABLE IF NOT EXISTS daily_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        total_purchases REAL DEFAULT 0,
        total_sales REAL DEFAULT 0,
        net_profit REAL DEFAULT 0
      );
    `);

    // 2. جدول المخزون والتنبيهات (لمراقبة الصلاحية والنواقص فقط)
    db.execSync(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        quantity INTEGER DEFAULT 0,
        expiry_date TEXT,
        min_alert_quantity INTEGER DEFAULT 0
      );
    `);

    // 3. جدول النقدية (الصندوق والبنك)
    db.execSync(`
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
    db.execSync(`
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
    db.execSync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL
      );
    `);

    console.log("تم إنشاء قاعدة البيانات والجداول بنجاح!");
    return true;
  } catch (error) {
    console.log("حدث خطأ أثناء إنشاء الجداول: ", error);
    throw error;
  }
};

// تصدير كائن قاعدة البيانات لاستخدامه في باقي الملفات
export default db;
