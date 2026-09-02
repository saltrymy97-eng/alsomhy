import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import db from '../db';
import * as XLSX from 'xlsx';

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
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
      
      // 3. جلب المشتريات المباشرة ومشتريات حركة اليومية (تم إصلاحها لاحتساب المشتريات بدقة)
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
      Alert.alert('خطأ', 'تعذّر استرجاع التقارير المالية من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  // تصدير البيانات إلى Excel
  const handleExportToExcel = () => {
    if (!Array.isArray(reportDetails) || reportDetails.length === 0) {
      Alert.alert('تنبيه', 'لا توجد بيانات مالية مسجلة لهذا الشهر لتصديرها.');
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
      Alert.alert('خطأ', 'فشل تصدير ملف الإكسل.');
    }
  };

  // تصدير البيانات إلى HTML للطباعة
  const handleExportToHTML = () => {
    if (!Array.isArray(reportDetails) || reportDetails.length === 0) {
      Alert.alert('تنبيه', 'لا توجد بيانات كافية لإنشاء التقرير.');
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
      Alert.alert('خطأ', 'فشل تصدير التقرير للطباعة.');
    }
  };

  const safeSales = Number(financialData?.monthlySales) || 0;
  const safeExpenses = (Number(financialData?.monthlyPurchases) || 0) + (Number(financialData?.monthlyExpenses) || 0);
  const safeNetIncome = Number(financialData?.monthlyNetIncome) || 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* شريط فلترة الشهر */}
      <View style={styles.monthSelectorBar}>
        <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(-1)}>
          <Text style={styles.monthNavText}>▶</Text>
        </TouchableOpacity>

        <View style={styles.monthDisplayContainer}>
          <Text style={styles.monthLabelText}>تقرير شهر:</Text>
          <Text style={styles.monthValueText}>{selectedMonth}</Text>
        </View>

        <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(1)}>
          <Text style={styles.monthNavText}>◀</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#0F172A" />
          <Text style={styles.loaderText}>جاري تجميع البيانات المالية للشهر...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* قسم بطاقات الملخص المالي */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>الملخص المالي لشهر ({selectedMonth})</Text>
            
            <View style={styles.summaryGrid}>
              <View style={[styles.card, styles.salesCard]}>
                <Text style={styles.cardTitle}>مبيعات الشهر</Text>
                <Text style={[styles.cardValue, { color: '#10B981' }]}>
                  {safeSales.toLocaleString()} <Text style={styles.currency}>ر.ي</Text>
                </Text>
              </View>

              <View style={[styles.card, styles.expensesCard]}>
                <Text style={styles.cardTitle}>المشتريات والمصروفات</Text>
                <Text style={[styles.cardValue, { color: '#EF4444' }]}>
                  {safeExpenses.toLocaleString()} <Text style={styles.currency}>ر.ي</Text>
                </Text>
              </View>
            </View>

            <View style={styles.netIncomeCard}>
              <Text style={styles.netIncomeTitle}>صافي الدخل الشهري</Text>
              <Text style={styles.netIncomeSubtitle}>إجمالي المبيعات - (المشتريات + المصروفات)</Text>
              <Text style={[styles.netIncomeValue, { color: safeNetIncome >= 0 ? '#10B981' : '#EF4444' }]}>
                {safeNetIncome.toLocaleString()} <Text style={styles.currencyLarge}>ريال يمني</Text>
              </Text>
            </View>
          </View>

          {/* أزرار التصدير */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>تصدير التقرير</Text>
            <View style={styles.exportButtonsRow}>
              <TouchableOpacity 
                style={[styles.exportButton, styles.excelButton]} 
                onPress={handleExportToExcel}
                activeOpacity={0.8}
              >
                <Text style={styles.exportButtonText}>تصدير إلى Excel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.exportButton, styles.htmlButton]} 
                onPress={handleExportToHTML}
                activeOpacity={0.8}
              >
                <Text style={styles.exportButtonText}>طباعة / HTML</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* قائمة التفاصيل */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>تفاصيل حركات الشهر ({reportDetails.length})</Text>
            {(!Array.isArray(reportDetails) || reportDetails.length === 0) ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>لا توجد حركات مالية مسجلة في هذا الشهر.</Text>
              </View>
            ) : (
              reportDetails.map((item, index) => {
                const type = item?.البند || 'غير محدد';
                const isSale = type === 'مبيعات';
                const amount = Number(item?.المبلغ) || 0;
                const date = item?.التاريخ ? new Date(item.التاريخ).toLocaleDateString('ar-YE') : '---';
                const desc = item?.البيان || '---';

                return (
                  <View key={index} style={styles.historyRow}>
                    <View style={styles.historyRowRight}>
                      <View style={[styles.typeBadge, isSale ? styles.badgeSale : styles.badgeExpense]}>
                        <Text style={[styles.typeBadgeText, isSale ? styles.textSale : styles.textExpense]}>{type}</Text>
                      </View>
                      <View>
                        <Text style={styles.historyItemTitle}>{desc}</Text>
                        <Text style={styles.historyItemDate}>{date}</Text>
                      </View>
                    </View>
                    <Text style={[styles.historyItemAmount, { color: isSale ? '#10B981' : '#EF4444' }]}>
                      {amount.toLocaleString()} ر.ي
                    </Text>
                  </View>
                );
              })
            )}
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingBottom: 30 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', gap: 12 },
  loaderText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  
  monthSelectorBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthNavBtn: {
    backgroundColor: '#F1F5F9',
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavText: { fontSize: 14, color: '#334155', fontWeight: 'bold' },
  monthDisplayContainer: { alignItems: 'center' },
  monthLabelText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  monthValueText: { fontSize: 15, color: '#0F172A', fontWeight: 'bold' },

  sectionContainer: { paddingHorizontal: 15, marginTop: 15 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', textAlign: 'right', marginBottom: 10 },
  summaryGrid: { flexDirection: 'row-reverse', gap: 10, marginBottom: 10 },
  card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 },
  salesCard: { borderRightWidth: 4, borderRightColor: '#10B981' },
  expensesCard: { borderRightWidth: 4, borderRightColor: '#EF4444' },
  cardTitle: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  cardValue: { fontSize: 15, fontWeight: 'bold', marginTop: 4 },
  currency: { fontSize: 10, color: '#64748B' },
  
  netIncomeCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRightWidth: 4, borderRightColor: '#0F172A', elevation: 1 },
  netIncomeTitle: { fontSize: 13, fontWeight: 'bold', color: '#1E293B', textAlign: 'right' },
  netIncomeSubtitle: { fontSize: 11, color: '#64748B', textAlign: 'right', marginTop: 2 },
  netIncomeValue: { fontSize: 20, fontWeight: '800', textAlign: 'right', marginTop: 6 },
  currencyLarge: { fontSize: 12, fontWeight: '500', color: '#64748B' },

  exportButtonsRow: { flexDirection: 'row-reverse', gap: 10 },
  exportButton: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 10, elevation: 1 },
  excelButton: { backgroundColor: '#10B981' },
  htmlButton: { backgroundColor: '#0F172A' },
  exportButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },

  historyRow: { backgroundColor: '#FFFFFF', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  historyRowRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeSale: { backgroundColor: '#D1FAE5' },
  badgeExpense: { backgroundColor: '#FEE2E2' },
  typeBadgeText: { fontSize: 10, fontWeight: 'bold' },
  textSale: { color: '#059669' },
  textExpense: { color: '#DC2626' },
  historyItemTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B', textAlign: 'right' },
  historyItemDate: { fontSize: 10, color: '#94A3B8', marginTop: 2, textAlign: 'right' },
  historyItemAmount: { fontSize: 13, fontWeight: 'bold' },
  emptyContainer: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  emptyText: { fontSize: 12, color: '#94A3B8' },
});
