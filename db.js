import * as SQLite from 'expo-sqlite';

// فتح أو إنشاء قاعدة البيانات محلياً على الجهاز
const db = SQLite.openDatabase('grocery_erp.db');

export const initDB = () => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      // 1. جدول السجل اليومي (المبيعات، المشتريات، الصافي)
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS daily_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          total_purchases REAL DEFAULT 0,
          total_sales REAL DEFAULT 0,
          net_profit REAL DEFAULT 0
        );`
      );

      // 2. جدول المخزون والتنبيهات (لمراقبة الصلاحية والنواقص فقط)
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS inventory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_name TEXT NOT NULL,
          quantity INTEGER DEFAULT 0,
          expiry_date TEXT,
          min_alert_quantity INTEGER DEFAULT 0
        );`
      );

      // 3. جدول النقدية (الصندوق والبنك)
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS treasury (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_type TEXT NOT NULL, -- 'cash' أو 'bank'
          transaction_type TEXT NOT NULL, -- 'deposit' أو 'withdraw'
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          notes TEXT
        );`
      );

      // 4. جدول العملاء والموردين (الديون والاستحقاقات)
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS contacts_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          contact_type TEXT NOT NULL, -- 'customer' أو 'supplier'
          amount_due REAL DEFAULT 0,
          due_date TEXT NOT NULL, -- تاريخ الاستحقاق
          status TEXT DEFAULT 'pending' -- 'pending' أو 'paid'
        );`
      );

      // 5. جدول المصروفات التشغيلية
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL
        );`
      );
    }, 
    (error) => {
      console.log("حدث خطأ أثناء إنشاء الجداول: ", error);
      reject(error);
    }, 
    () => {
      console.log("تم إنشاء قاعدة البيانات والجداول بنجاح!");
      resolve();
    });
  });
};

// تصدير كائن قاعدة البيانات لاستخدامه في باقي الملفات
export default db;
