import React, { useState, useEffect } from 'react';
import db from '../db';
import * as XLSX from 'xlsx';

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const [financialData, setFinancialData] = useState({
    monthlySales: 0,
    monthlyPurchases: 0,
    monthlyExpenses: 0,
    monthlyNetIncome: 0,
  });
  const [reportDetails, setReportDetails] = useState([]);

  useEffect(() => {
    initTablesAndFetchData();
  }, [selectedMonth]);

  const changeMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  // تهيئة الجداول وجلب وحساب البيانات المالية المفلترة بالشهر
  const initTablesAndFetchData = async () => {
    try {
      setLoading(true);

      // 1. ضمان وجود الجداول الأساسية
      await db.run(`
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          total_amount REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await db.run(`
        CREATE TABLE IF NOT EXISTS purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          total_amount REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const monthPattern = `${selectedMonth}%`;

      // 2. جلب المبيعات المباشرة وحركات اليومية
      const salesRes = await db.getAll('SELECT SUM(total_amount) as total FROM sales WHERE created_at LIKE ? OR date LIKE ?;', [monthPattern, monthPattern]);
      const dailySalesRes = await db.getAll('SELECT SUM(total_sales) as total FROM daily_transactions WHERE date LIKE ?;', [monthPattern]);
      
      // 3. جلب المشتريات المباشرة ومشتريات حركة اليومية
      const purchasesRes = await db.getAll('SELECT SUM(total_amount) as total FROM purchases WHERE created_at LIKE ? OR date LIKE ?;', [monthPattern, monthPattern]);
      const dailyPurchasesRes = await db.getAll('SELECT SUM(total_purchases) as total FROM daily_transactions WHERE date LIKE ?;', [monthPattern]);

      // 4. جلب المصروفات وسحوبات الخزينة التشغيلية
      const expensesRes = await db.getAll('SELECT SUM(amount) as total FROM expenses WHERE created_at LIKE ? OR date LIKE ?;', [monthPattern, monthPattern]);
      const treasuryExpensesRes = await db.getAll("SELECT SUM(amount) as total FROM treasury WHERE transaction_type IN ('expense', 'صرف', 'سحب') AND date LIKE ?;", [monthPattern]);

      const monthlySales = Number(salesRes?.[0]?.total || 0) + Number(dailySalesRes?.[0]?.total || 0);
      const monthlyPurchases = Number(purchasesRes?.[0]?.total || 0) + Number(dailyPurchasesRes?.[0]?.total || 0);
      const monthlyExpenses = Number(expensesRes?.[0]?.total || 0) + Number(treasuryExpensesRes?.[0]?.total || 0);
      
      // صافي الدخل الشهري الصحيح = المبيعات - (المشتريات + المصروفات)
      const monthlyNetIncome = monthlySales - (monthlyPurchases + monthlyExpenses);

      // 5. جلب التفاصيل المفلترة للشهر المختار لعرضها في السجل
      const monthSales = (await db.getAll('SELECT id, total_amount, created_at FROM sales WHERE created_at LIKE ? OR date LIKE ? ORDER BY id DESC;', [monthPattern, monthPattern])) || [];
      const monthDaily = (await db.getAll('SELECT id, total_sales, total_purchases, net_profit, date FROM daily_transactions WHERE date LIKE ? ORDER BY id DESC;', [monthPattern])) || [];
      const monthPurchases = (await db.getAll('SELECT id, total_amount, created_at FROM purchases WHERE created_at LIKE ? OR date LIKE ? ORDER BY id DESC;', [monthPattern, monthPattern])) || [];
      const monthExpenses = (await db.getAll('SELECT id, amount, description, created_at FROM expenses WHERE created_at LIKE ? OR date LIKE ? ORDER BY id DESC;', [monthPattern, monthPattern])) || [];

      const formattedDetails = [
        ...monthSales.map(s => ({ البند: 'مبيعات', المبلغ: Number(s.total_amount || 0), البيان: 'فاتورة مبيعات', التاريخ: s.created_at })),
        ...monthDaily.filter(d => Number(d.total_sales) > 0).map(d => ({ البند: 'مبيعات', المبلغ: Number(d.total_sales || 0), البيان: 'حركة يومية (مبيعات)', التاريخ: d.date })),
        ...monthDaily.filter(d => Number(d.total_purchases) > 0).map(d => ({ البند: 'مشتريات', المبلغ: Number(d.total_purchases || 0), البيان: 'حركة يومية (مشتريات)', التاريخ: d.date })),
        ...monthPurchases.map(p => ({ البند: 'مشتريات', المبلغ: Number(p.total_amount || 0), البيان: 'شراء بضاعة', التاريخ: p.created_at })),
        ...monthExpenses.map(e => ({ البند: 'مصروفات', المبلغ: Number(e.amount || 0), البيان: e.description || 'مصروفات تشغيلية', التاريخ: e.created_at })),
      ].sort((a, b) => new Date(b.التاريخ || 0) - new Date(a.التاريخ || 0));

      setReportDetails(formattedDetails);
      setFinancialData({
        monthlySales,
        monthlyPurchases,
        monthlyExpenses,
        monthlyNetIncome,
      });
    } catch (error) {
      console.error('خطأ في جلب البيانات المالية:', error);
      alert('تعذّر استرجاع التقارير المالية من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // وحدة النسخ الاحتياطي والاستعادة لـ Desktop Electron
  // ==========================================
  const handleCreateBackup = async () => {
    try {
      const electronApi = window.api || window.electronAPI;
      if (!electronApi || !electronApi.backupDatabase) {
        alert('خاصية النسخ الاحتياطي متاحة فقط في بيئة تطبيق الديسكتوب (Electron).');
        return;
      }

      setBackupLoading(true);
      const res = await electronApi.backupDatabase();
      if (res.success) {
        alert('💾 ' + res.message);
      } else if (res.message !== 'تم إلغاء العملية') {
        alert('فشل العملية: ' + res.message);
      }
    } catch (err) {
      console.error('خطأ أثناء النسخ الاحتياطي:', err);
      alert('حدث خطأ أثناء حفظ النسخة الاحتياطية.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    const electronApi = window.api || window.electronAPI;
    if (!electronApi || !electronApi.restoreDatabase) {
      alert('خاصية استعادة النسخة متاحة فقط في بيئة تطبيق الديسكتوب (Electron).');
      return;
    }

    const confirmRestore = window.confirm("⚠️ تحذير هام:\nاستعادة نسخة قديمة ستستبدل بيانات قاعدة البيانات الحالية بالكامل.\n\nهل تريد الاستمرار؟");
    if (!confirmRestore) return;

    try {
      setBackupLoading(true);
      const res = await electronApi.restoreDatabase();
      if (res.success) {
        alert('🎉 ' + res.message);
        initTablesAndFetchData();
      } else if (res.message !== 'تم إلغاء العملية') {
        alert('فشلت الاستعادة: ' + res.message);
      }
    } catch (err) {
      console.error('خطأ أثناء الاستعادة:', err);
      alert('حدث خطأ أثناء استعادة النسخة الاحتياطية.');
    } finally {
      setBackupLoading(false);
    }
  };

  // تصدير البيانات إلى Excel
  const handleExportToExcel = () => {
    if (!Array.isArray(reportDetails) || reportDetails.length === 0) {
      alert('لا توجد بيانات مالية مسجلة لهذا الشهر لتصديرها.');
      return;
    }

    try {
      const worksheetData = reportDetails.map(item => ({
        'نوع البند': item?.البند || 'غير محدد',
        'المبلغ (ر.ي)': Number(item?.المبلغ) || 0,
        'البيان والتفاصيل': item?.البيان || '---',
        'تاريخ الحركة': item?.التاريخ ? new Date(item.التاريخ).toLocaleString('ar-YE') : 'غير محدد',
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `تقرير_${selectedMonth}`);
      
      XLSX.writeFile(workbook, `Financial_Report_${selectedMonth}.xlsx`);
    } catch (error) {
      console.error('خطأ في تصدير الإكسل:', error);
      alert('فشل تصدير ملف الإكسل.');
    }
  };

  // تصدير البيانات إلى HTML للطباعة
  const handleExportToHTML = () => {
    if (!Array.isArray(reportDetails) || reportDetails.length === 0) {
      alert('لا توجد بيانات كافية لإنشاء التقرير.');
      return;
    }

    try {
      const safeSales = Number(financialData?.monthlySales) || 0;
      const safeExpenses = (Number(financialData?.monthlyPurchases) || 0) + (Number(financialData?.monthlyExpenses) || 0);
      const safeNetIncome = Number(financialData?.monthlyNetIncome) || 0;

      let tableRows = '';
      for (let i = 0; i < reportDetails.length; i++) {
        const item = reportDetails[i];
        const type = item?.البند || 'غير محدد';
        const amount = Number(item?.المبلغ) || 0;
        const desc = item?.البيان || '---';
        const date = item?.التاريخ ? new Date(item.التاريخ).toLocaleString('ar-YE') : 'غير محدد';
        const amountColor = type === 'مبيعات' ? '#10B981' : '#EF4444';

        tableRows += `
          <tr>
            <td><b>${type}</b></td>
            <td style="font-weight: bold; color: ${amountColor};">${amount.toLocaleString()}</td>
            <td>${desc}</td>
            <td>${date}</td>
          </tr>
        `;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير قائمة الدخل - ${selectedMonth}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #0F172A; padding: 30px; margin: 0; }
            .container { background-color: #FFFFFF; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 900px; margin: auto; }
            .header { text-align: center; border-bottom: 2px solid #F1F5F9; padding-bottom: 20px; margin-bottom: 25px; }
            .header h1 { color: #1E293B; margin: 0 0 8px 0; font-size: 24px; }
            .header p { color: #64748B; margin: 0; font-size: 13px; }
            .summary-box { display: flex; justify-content: space-around; background: #F8FAFC; padding: 15px; border-radius: 10px; margin-bottom: 25px; text-align: center; }
            .summary-item h3 { margin: 0; font-size: 13px; color: #64748B; }
            .summary-item p { margin: 5px 0 0 0; font-size: 17px; font-weight: bold; color: #0F172A; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 12px 15px; text-align: right; border-bottom: 1px solid #E2E8F0; }
            th { background-color: #F1F5F9; color: #334155; font-weight: bold; font-size: 13px; }
            td { color: #475569; font-size: 13px; }
            .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #F1F5F9; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>تقرير قائمة الدخل والسيولة - شهر (${selectedMonth})</h1>
              <p>تاريخ إصدار التقرير: ${new Date().toLocaleDateString('ar-YE')}</p>
            </div>
            
            <div class="summary-box">
              <div class="summary-item">
                <h3>إجمالي المبيعات</h3>
                <p style="color: #10B981;">${safeSales.toLocaleString()} ر.ي</p>
              </div>
              <div class="summary-item">
                <h3>إجمالي المصروفات والمشتريات</h3>
                <p style="color: #EF4444;">${safeExpenses.toLocaleString()} ر.ي</p>
              </div>
              <div class="summary-item">
                <h3>صافي الدخل الشهري</h3>
                <p style="color: #0F172A;">${safeNetIncome.toLocaleString()} ر.ي</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>نوع البند</th>
                  <th>المبلغ (ر.ي)</th>
                  <th>البيان / التفاصيل</th>
                  <th>التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <div class="footer">
              <p>تم استخراج هذا التقرير آلياً عبر نظام الميزان المحاسبي</p>
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      
      if (!printWindow) {
        alert('يرجى السماح بفتح النوافذ المنبثقة لعرض التقرير');
      }
    } catch (error) {
      console.error('خطأ في تصدير HTML:', error);
      alert('فشل تصدير التقرير للطباعة.');
    }
  };

  const safeSales = Number(financialData?.monthlySales) || 0;
  const safeExpenses = (Number(financialData?.monthlyPurchases) || 0) + (Number(financialData?.monthlyExpenses) || 0);
  const safeNetIncome = Number(financialData?.monthlyNetIncome) || 0;

  return (
    <div style={styles.container}>
      {/* شريط اختيار الشهر */}
      <div style={styles.monthSelectorBar}>
        <button style={styles.monthNavBtn} onClick={() => changeMonth(-1)}>▶</button>
        <div style={styles.monthDisplayContainer}>
          <span style={styles.monthLabelText}>تقرير شهر: </span>
          <span style={styles.monthValueText}>{selectedMonth}</span>
        </div>
        <button style={styles.monthNavBtn} onClick={() => changeMonth(1)}>◀</button>
      </div>

      {loading ? (
        <div style={styles.loaderContainer}>
          <div style={styles.loaderText}>جاري تجميع البيانات المالية للشهر...</div>
        </div>
      ) : (
        <div style={styles.scrollContent}>

          {/* قسم حماية البيانات والنسخ الاحتياطي للديسكتوب */}
          <div style={styles.sectionContainer}>
            <div style={styles.sectionTitle}>حماية البيانات والنسخ الاحتياطي 🛡️</div>
            <div style={styles.backupCard}>
              <div style={styles.backupSubtext}>
                احفظ نسخة احتياطية من قواعد بياناتك المحاسبية بأمان على الكمبيوتر لحمايتها من الفقدان أو لاستعادتها عند الحاجة.
              </div>
              <div style={styles.backupButtonsRow}>
                <button 
                  style={{ ...styles.backupButton, ...styles.createBackupBtn, opacity: backupLoading ? 0.6 : 1 }} 
                  onClick={handleCreateBackup}
                  disabled={backupLoading}
                >
                  💾 {backupLoading ? 'جاري المعالجة...' : 'إنشاء نسخة احتياطية'}
                </button>
                <button 
                  style={{ ...styles.backupButton, ...styles.restoreBackupBtn, opacity: backupLoading ? 0.6 : 1 }} 
                  onClick={handleRestoreBackup}
                  disabled={backupLoading}
                >
                  🔄 {backupLoading ? 'جاري المعالجة...' : 'استعادة نسخة سابقـة'}
                </button>
              </div>
            </div>
          </div>

          {/* قسم بطاقات الملخص المالي */}
          <div style={styles.sectionContainer}>
            <div style={styles.sectionTitle}>الملخص المالي لشهر ({selectedMonth})</div>
            <div style={styles.summaryGrid}>
              <div style={{ ...styles.card, ...styles.salesCard }}>
                <div style={styles.cardTitle}>مبيعات الشهر</div>
                <div style={{ ...styles.cardValue, color: '#10B981' }}>
                  {safeSales.toLocaleString()} <span style={styles.currency}>ر.ي</span>
                </div>
              </div>

              <div style={{ ...styles.card, ...styles.expensesCard }}>
                <div style={styles.cardTitle}>المشتريات والمصروفات</div>
                <div style={{ ...styles.cardValue, color: '#EF4444' }}>
                  {safeExpenses.toLocaleString()} <span style={styles.currency}>ر.ي</span>
                </div>
              </div>
            </div>

            <div style={styles.netIncomeCard}>
              <div style={styles.netIncomeTitle}>صافي الدخل الشهري</div>
              <div style={styles.netIncomeSubtitle}>إجمالي المبيعات - (المشتريات + المصروفات)</div>
              <div style={{ ...styles.netIncomeValue, color: safeNetIncome >= 0 ? '#10B981' : '#EF4444' }}>
                {safeNetIncome.toLocaleString()} <span style={styles.currencyLarge}>ريال يمني</span>
              </div>
            </div>
          </div>

          {/* أزرار التصدير والطباعة */}
          <div style={styles.sectionContainer}>
            <div style={styles.sectionTitle}>تصدير التقرير</div>
            <div style={styles.exportButtonsRow}>
              <button style={{ ...styles.exportButton, ...styles.excelButton }} onClick={handleExportToExcel}>
                تصدير إلى Excel
              </button>
              <button style={{ ...styles.exportButton, ...styles.htmlButton }} onClick={handleExportToHTML}>
                طباعة / HTML
              </button>
            </div>
          </div>

          {/* سجل تفاصيل حركات الشهر */}
          <div style={styles.sectionContainer}>
            <div style={styles.sectionTitle}>تفاصيل حركات الشهر ({reportDetails.length})</div>
            {(!Array.isArray(reportDetails) || reportDetails.length === 0) ? (
              <div style={styles.emptyContainer}>
                <div style={styles.emptyText}>لا توجد حركات مالية مسجلة في هذا الشهر.</div>
              </div>
            ) : (
              reportDetails.map((item, index) => {
                const type = item?.البند || 'غير محدد';
                const isSale = type === 'مبيعات';
                const amount = Number(item?.المبلغ) || 0;
                const date = item?.التاريخ ? new Date(item.التاريخ).toLocaleDateString('ar-YE') : '---';
                const desc = item?.البيان || '---';

                return (
                  <div key={index} style={styles.historyRow}>
                    <div style={styles.historyRowRight}>
                      <span style={{ ...styles.typeBadge, backgroundColor: isSale ? '#D1FAE5' : '#FEE2E2', color: isSale ? '#059669' : '#DC2626' }}>
                        {type}
                      </span>
                      <div>
                        <div style={styles.historyItemTitle}>{desc}</div>
                        <div style={styles.historyItemDate}>{date}</div>
                      </div>
                    </div>
                    <div style={{ ...styles.historyItemAmount, color: isSale ? '#10B981' : '#EF4444' }}>
                      {amount.toLocaleString()} ر.ي
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// تنسيقات CSS-in-JS مخصصة للماوس والديسكتوب
const styles = {
  container: {
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    backgroundColor: '#F8FAFC',
    minHeight: '100vh',
    direction: 'rtl',
    color: '#0F172A',
  },
  monthSelectorBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: '12px 24px',
    borderBottom: '1px solid #E2E8F0',
  },
  monthNavBtn: {
    backgroundColor: '#F1F5F9',
    border: 'none',
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 'bold',
    color: '#334155',
    userSelect: 'none',
    outline: 'none',
  },
  monthDisplayContainer: { textAlign: 'center', userSelect: 'none' },
  monthLabelText: { fontSize: '13px', color: '#64748B', fontWeight: '600' },
  monthValueText: { fontSize: '16px', color: '#0F172A', fontWeight: 'bold' },

  loaderContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '300px',
  },
  loaderText: { fontSize: '14px', color: '#64748B', fontWeight: '600' },

  scrollContent: { padding: '20px', maxWidth: '1100px', margin: '0 auto' },
  sectionContainer: { marginBottom: '24px' },
  sectionTitle: { fontSize: '15px', fontWeight: 'bold', color: '#1E293B', marginBottom: '12px', userSelect: 'none' },

  backupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '18px',
    border: '1px solid #E2E8F0',
    borderRight: '5px solid #2563EB',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  backupSubtext: { fontSize: '13px', color: '#64748B', marginBottom: '14px', lineHeight: '1.6' },
  backupButtonsRow: { display: 'flex', gap: '12px' },
  backupButton: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    userSelect: 'none',
    outline: 'none',
    transition: 'opacity 0.2s ease, transform 0.1s ease',
  },
  createBackupBtn: { backgroundColor: '#2563EB' },
  restoreBackupBtn: { backgroundColor: '#475569' },

  summaryGrid: { display: 'flex', gap: '16px', marginBottom: '16px' },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '18px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  salesCard: { borderRight: '5px solid #10B981' },
  expensesCard: { borderRight: '5px solid #EF4444' },
  cardTitle: { fontSize: '12px', color: '#64748B', fontWeight: '600' },
  cardValue: { fontSize: '20px', fontWeight: 'bold', marginTop: '6px' },
  currency: { fontSize: '12px', color: '#64748B' },

  netIncomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #E2E8F0',
    borderRight: '5px solid #0F172A',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  netIncomeTitle: { fontSize: '14px', fontWeight: 'bold', color: '#1E293B' },
  netIncomeSubtitle: { fontSize: '12px', color: '#64748B', marginTop: '2px' },
  netIncomeValue: { fontSize: '26px', fontWeight: '800', marginTop: '8px' },
  currencyLarge: { fontSize: '14px', color: '#64748B', fontWeight: '500' },

  exportButtonsRow: { display: 'flex', gap: '12px' },
  exportButton: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    userSelect: 'none',
    outline: 'none',
  },
  excelButton: { backgroundColor: '#10B981' },
  htmlButton: { backgroundColor: '#0F172A' },

  historyRow: {
    backgroundColor: '#FFFFFF',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    borderRadius: '10px',
    marginBottom: '10px',
    border: '1px solid #F1F5F9',
  },
  historyRowRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  typeBadge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 'bold',
    userSelect: 'none',
  },
  historyItemTitle: { fontSize: '14px', fontWeight: '600', color: '#1E293B' },
  historyItemDate: { fontSize: '11px', color: '#94A3B8', marginTop: '2px' },
  historyItemAmount: { fontSize: '15px', fontWeight: 'bold' },

  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    padding: '30px',
    textAlign: 'center',
    border: '1px solid #F1F5F9',
  },
  emptyText: { fontSize: '13px', color: '#94A3B8' },
};
