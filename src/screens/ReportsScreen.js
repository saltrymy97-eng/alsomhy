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
  const [financialData, setFinancialData] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    netIncome: 0,
    monthlySales: 0,
    monthlyPurchases: 0,
    monthlyExpenses: 0,
    monthlyNetIncome: 0,
  });
  const [reportDetails, setReportDetails] = useState([]);

  useEffect(() => {
    initTablesAndFetchData();
  }, []);

  // تهيئة الجداول وجلب وحساب البيانات المالية بشكل لامتزامن
  const initTablesAndFetchData = async () => {
    try {
      setLoading(true);
      await db.query(`
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          total_amount REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          total_amount REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const salesRes = await db.query('SELECT SUM(total_amount) as total FROM sales;');
      const purchasesRes = await db.query('SELECT SUM(total_amount) as total FROM purchases;');
      const expensesRes = await db.query('SELECT SUM(amount) as total FROM expenses;');

      const totalSales = salesRes?.[0]?.total || 0;
      const totalPurchases = purchasesRes?.[0]?.total || 0;
      const totalExpenses = expensesRes?.[0]?.total || 0;
      const netIncome = totalSales - (totalPurchases + totalExpenses);

      const allSales = (await db.query('SELECT id, total_amount, created_at FROM sales ORDER BY id DESC;')) || [];
      const allPurchases = (await db.query('SELECT id, total_amount, created_at FROM purchases ORDER BY id DESC;')) || [];
      const allExpenses = (await db.query('SELECT id, amount, description, created_at FROM expenses ORDER BY id DESC;')) || [];

      const formattedDetails = [
        ...allSales.map(s => ({ البند: 'مبيعات', المبلغ: s.total_amount, البيان: 'إيراد مبيعات', التاريخ: s.created_at })),
        ...allPurchases.map(p => ({ البند: 'مشتريات', المبلغ: p.total_amount, البيان: 'شراء بضاعة', التاريخ: p.created_at })),
        ...allExpenses.map(e => ({ البند: 'مصروفات', المبلغ: e.amount, البيان: e.description || 'مصروفات تشغيلية', التاريخ: e.created_at })),
      ].sort((a, b) => new Date(b.التاريخ) - new Date(a.التاريخ));

      setReportDetails(formattedDetails);
      setFinancialData({
        totalSales,
        totalPurchases,
        totalExpenses,
        netIncome,
        monthlySales: totalSales,
        monthlyPurchases: totalPurchases,
        monthlyExpenses: totalExpenses,
        monthlyNetIncome: netIncome,
      });
    } catch (error) {
      console.error('خطأ في جلب البيانات المالية:', error);
      Alert.alert('خطأ', 'تعذّر استرجاع التقارير المالية من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  // 1. تصدير البيانات إلى ملف Excel (.xlsx) عبر المتصفح
  const handleExportToExcel = () => {
    if (!Array.isArray(reportDetails) || reportDetails.length === 0) {
      Alert.alert('تنبيه', 'لا توجد بيانات مالية كافية لتصديرها.');
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'قائمة الدخل والتقارير');
      
      XLSX.writeFile(workbook, `Financial_Report_${Date.now()}.xlsx`);
    } catch (error) {
      console.error('خطأ في تصدير الإكسل:', error);
      Alert.alert('خطأ', 'فشل تصدير ملف الإكسل.');
    }
  };

  // 2. تصدير البيانات إلى صفحة HTML وعرضها للطباعة
  const handleExportToHTML = () => {
    if (!Array.isArray(reportDetails) || reportDetails.length === 0) {
      Alert.alert('تنبيه', 'لا توجد بيانات كافية لإنشاء التقرير.');
      return;
    }

    try {
      const safeTotalSales = Number(financialData?.totalSales) || 0;
      const safeTotalExpensesAndPurchases = (Number(financialData?.totalPurchases) || 0) + (Number(financialData?.totalExpenses) || 0);
      const safeNetIncome = Number(financialData?.netIncome) || 0;

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
          <title>قائمة الدخل والتقارير المالية - البقالة</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #0F172A; padding: 30px; margin: 0; }
            .container { background-color: #FFFFFF; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 900px; margin: auto; }
            .header { text-align: center; border-bottom: 2px solid #F1F5F9; padding-bottom: 20px; margin-bottom: 25px; }
            .header h1 { color: #1E293B; margin: 0 0 8px 0; font-size: 26px; }
            .header p { color: #64748B; margin: 0; font-size: 13px; }
            .summary-box { display: flex; justify-content: space-around; background: #F8FAFC; padding: 15px; border-radius: 10px; margin-bottom: 25px; text-align: center; }
            .summary-item h3 { margin: 0; font-size: 14px; color: #64748B; }
            .summary-item p { margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #0F172A; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 12px 15px; text-align: right; border-bottom: 1px solid #E2E8F0; }
            th { background-color: #F1F5F9; color: #334155; font-weight: bold; font-size: 14px; }
            td { color: #475569; font-size: 13px; }
            tr:hover { background-color: #F8FAFC; }
            .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #F1F5F9; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>تقرير قائمة الدخل والسيولة</h1>
              <p>تاريخ إصدار التقرير: ${new Date().toLocaleDateString('ar-YE')}</p>
            </div>
            
            <div class="summary-box">
              <div class="summary-item">
                <h3>إجمالي المبيعات</h3>
                <p style="color: #10B981;">${safeTotalSales.toLocaleString()} ر.ي</p>
              </div>
              <div class="summary-item">
                <h3>إجمالي المصروفات</h3>
                <p style="color: #EF4444;">${safeTotalExpensesAndPurchases.toLocaleString()} ر.ي</p>
              </div>
              <div class="summary-item">
                <h3>صافي الدخل العام</h3>
                <p style="color: #2563EB;">${safeNetIncome.toLocaleString()} ر.ي</p>
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
              <p>تم استخراج هذا التقرير آلياً عبر تطبيق إدارة البقالات الذكي</p>
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

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loaderText}>جاري إعداد وتحليل التقارير المالية...</Text>
      </View>
    );
  }

  const safeRenderTotalSales = Number(financialData?.totalSales) || 0;
  const safeRenderTotalExpenses = (Number(financialData?.totalPurchases) || 0) + (Number(financialData?.totalExpenses) || 0);
  const safeRenderNetIncome = Number(financialData?.netIncome) || 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>التقارير وقائمة الدخل</Text>
          <Text style={styles.headerSubtitle}>تحليل الأداء المالي والموقف العام للبقالة</Text>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>الملخص المالي الشامل</Text>
          
          <View style={styles.summaryGrid}>
            <View style={[styles.card, styles.salesCard]}>
              <Text style={styles.cardIcon}>📈</Text>
              <Text style={styles.cardTitle}>إجمالي المبيعات</Text>
              <Text style={[styles.cardValue, { color: '#10B981' }]}>
                {safeRenderTotalSales.toLocaleString()} <Text style={styles.currency}>ر.ي</Text>
              </Text>
            </View>

            <View style={[styles.card, styles.expensesCard]}>
              <Text style={styles.cardIcon}>📉</Text>
              <Text style={styles.cardTitle}>المشتريات والمصروفات</Text>
              <Text style={[styles.cardValue, { color: '#EF4444' }]}>
                {safeRenderTotalExpenses.toLocaleString()} <Text style={styles.currency}>ر.ي</Text>
              </Text>
            </View>
          </View>

          <View style={styles.netIncomeCard}>
            <View style={styles.netIncomeHeader}>
              <View>
                <Text style={styles.netIncomeTitle}>صافي الدخل النهائي (الربح الصافي)</Text>
                <Text style={styles.netIncomeSubtitle}>المبيعات - (المشتريات + المصروفات)</Text>
              </View>
              <Text style={styles.largeIcon}>💰</Text>
            </View>
            <Text style={[styles.netIncomeValue, { color: safeRenderNetIncome >= 0 ? '#10B981' : '#EF4444' }]}>
              {safeRenderNetIncome.toLocaleString()} <Text style={styles.currencyLarge}>ريال يمني</Text>
            </Text>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>تصدير التقارير والملفات</Text>
          <View style={styles.exportButtonsRow}>
            <TouchableOpacity 
              style={[styles.exportButton, styles.excelButton]} 
              onPress={handleExportToExcel}
              activeOpacity={0.8}
            >
              <Text style={styles.exportButtonText}>📊 تصدير إلى Excel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.exportButton, styles.htmlButton]} 
              onPress={handleExportToHTML}
              activeOpacity={0.8}
            >
              <Text style={styles.exportButtonText}>🖨️ طباعة / HTML</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>آخر العمليات المدرجة في التقرير</Text>
          {(!Array.isArray(reportDetails) || reportDetails.length === 0) ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>لا توجد حركات مسجلة حالياً لعرضها</Text>
            </View>
          ) : (
            reportDetails.slice(0, 5).map((item, index) => {
              const type = item?.البند || 'غير محدد';
              const isSale = type === 'مبيعات';
              const amount = Number(item?.المبلغ) || 0;
              const date = item?.التاريخ ? new Date(item.التاريخ).toLocaleDateString('ar-YE') : '---';
              const desc = item?.البيان || '---';

              return (
                <View key={index} style={styles.historyRow}>
                  <View style={styles.historyRowRight}>
                    <Text style={styles.historyIcon}>{isSale ? '📥' : '📤'}</Text>
                    <View>
                      <Text style={styles.historyItemTitle}>{type}: {desc}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingBottom: 30 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', gap: 12 },
  loaderText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  headerContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, alignItems: 'flex-start' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'right' },
  headerSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'right', marginTop: 2 },
  sectionContainer: { paddingHorizontal: 20, marginTop: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', textAlign: 'right', marginBottom: 10 },
  summaryGrid: { flexDirection: 'row-reverse', gap: 12, marginBottom: 12 },
  card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2, alignItems: 'flex-start' },
  salesCard: { borderRightWidth: 4, borderRightColor: '#10B981' },
  expensesCard: { borderRightWidth: 4, borderRightColor: '#EF4444' },
  cardIcon: { fontSize: 22, marginBottom: 4 },
  largeIcon: { fontSize: 28 },
  cardTitle: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 4 },
  cardValue: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  currency: { fontSize: 11, fontWeight: '400', color: '#64748B' },
  netIncomeCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', borderRightWidth: 4, borderRightColor: '#2563EB', elevation: 3 },
  netIncomeHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  netIncomeTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', textAlign: 'right' },
  netIncomeSubtitle: { fontSize: 11, color: '#64748B', textAlign: 'right', marginTop: 2 },
  netIncomeValue: { fontSize: 22, fontWeight: '800', textAlign: 'right', marginTop: 6 },
  currencyLarge: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  exportButtonsRow: { flexDirection: 'row-reverse', gap: 12 },
  exportButton: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 12, elevation: 2 },
  excelButton: { backgroundColor: '#059669' },
  htmlButton: { backgroundColor: '#2563EB' },
  exportButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  historyRow: { backgroundColor: '#FFFFFF', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  historyRowRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  historyIcon: { fontSize: 18 },
  historyItemTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B', textAlign: 'right' },
  historyItemDate: { fontSize: 10, color: '#94A3B8', marginTop: 2, textAlign: 'right' },
  historyItemAmount: { fontSize: 13, fontWeight: '700' },
  emptyContainer: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1F5F9', gap: 8 },
  emptyEmoji: { fontSize: 32 },
  emptyText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
});
