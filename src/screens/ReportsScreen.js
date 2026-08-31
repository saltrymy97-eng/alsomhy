import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Easing,
  Platform
} from 'react-native';
import db from '../db';
import * as XLSX from 'xlsx';

// ==========================================
// 💎 المكون التفاعلي: الأيقونة الـ 3D المتحركة والفاخرة
// ==========================================
const Luxury3DReportsIcon = () => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // حركة طفو 3D مستمرة
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1800,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // حركة نبض بريق دائرية
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.iconWrapper}>
      <Animated.View 
        style={[
          styles.icon3DOuter,
          {
            transform: [
              { translateY: floatAnim },
              { scale: pulseAnim }
            ]
          }
        ]}
      >
        <View style={styles.icon3DInner}>
          <Text style={styles.iconEmoji}>📈</Text>
        </View>
      </Animated.View>
    </View>
  );
};

export default function ReportsScreen() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [financialData, setFinancialData] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    netIncome: 0,
  });
  const [reportDetails, setReportDetails] = useState([]);

  useEffect(() => {
    initTablesAndFetchData();
  }, [selectedMonth]);

  // التنقل بين الأشهُر
  const changeMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  // تهيئة الجداول وجلب البيانات المالية المفلترة شهرياً
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

      // 1. استعلامات المجاميع المالية للشهر المختار
      const salesRes = await db.query(
        `SELECT SUM(total_amount) as total FROM sales WHERE strftime('%Y-%m', created_at) = ?;`,
        [selectedMonth]
      );
      const purchasesRes = await db.query(
        `SELECT SUM(total_amount) as total FROM purchases WHERE strftime('%Y-%m', created_at) = ?;`,
        [selectedMonth]
      );
      const expensesRes = await db.query(
        `SELECT SUM(amount) as total FROM expenses WHERE strftime('%Y-%m', created_at) = ?;`,
        [selectedMonth]
      );

      const totalSales = salesRes?.[0]?.total || 0;
      const totalPurchases = purchasesRes?.[0]?.total || 0;
      const totalExpenses = expensesRes?.[0]?.total || 0;
      const netIncome = totalSales - (totalPurchases + totalExpenses);

      // 2. جلب التفاصيل الحسابية للشهر المختار
      const allSales = (await db.query(
        `SELECT id, total_amount, created_at FROM sales WHERE strftime('%Y-%m', created_at) = ? ORDER BY id DESC;`,
        [selectedMonth]
      )) || [];
      const allPurchases = (await db.query(
        `SELECT id, total_amount, created_at FROM purchases WHERE strftime('%Y-%m', created_at) = ? ORDER BY id DESC;`,
        [selectedMonth]
      )) || [];
      const allExpenses = (await db.query(
        `SELECT id, amount, description, created_at FROM expenses WHERE strftime('%Y-%m', created_at) = ? ORDER BY id DESC;`,
        [selectedMonth]
      )) || [];

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
      });
    } catch (error) {
      console.error('خطأ في جلب البيانات المالية:', error);
      Alert.alert('خطأ', 'تعذّر استرجاع التقارير المالية من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  // تصدير البيانات إلى ملف Excel (.xlsx)
  const handleExportToExcel = () => {
    if (!Array.isArray(reportDetails) || reportDetails.length === 0) {
      Alert.alert('تنبيه', 'لا توجد بيانات مالية كافية لتصديرها للشهر المحدد.');
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
      
      XLSX.writeFile(workbook, `Financial_Report_${selectedMonth}_${Date.now()}.xlsx`);
    } catch (error) {
      console.error('خطأ في تصدير الإكسل:', error);
      Alert.alert('خطأ', 'فشل تصدير ملف الإكسل.');
    }
  };

  // تصدير البيانات إلى صفحة HTML وعرضها للطباعة
  const handleExportToHTML = () => {
    if (!Array.isArray(reportDetails) || reportDetails.length === 0) {
      Alert.alert('تنبيه', 'لا توجد بيانات كافية لإنشاء التقرير للشهر المحدد.');
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
          <title>قائمة الدخل والتقارير المالية - ${selectedMonth}</title>
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
              <h1>تقرير قائمة الدخل والسيولة لشهر (${selectedMonth})</h1>
              <p>تاريخ إصدار التقرير: ${new Date().toLocaleDateString('ar-YE')}</p>
            </div>
            
            <div class="summary-box">
              <div class="summary-item">
                <h3>إجمالي المبيعات</h3>
                <p style="color: #10B981;">${safeTotalSales.toLocaleString()} ر.ي</p>
              </div>
              <div class="summary-item">
                <h3>إجمالي المصروفات والمشتريات</h3>
                <p style="color: #EF4444;">${safeTotalExpensesAndPurchases.toLocaleString()} ر.ي</p>
              </div>
              <div class="summary-item">
                <h3>صافي الدخل الشهر</h3>
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
        <Text style={styles.loaderText}>جاري إعداد وتحليل التقارير المالية لشهر {selectedMonth}...</Text>
      </View>
    );
  }

  const safeRenderTotalSales = Number(financialData?.totalSales) || 0;
  const safeRenderTotalExpenses = (Number(financialData?.totalPurchases) || 0) + (Number(financialData?.totalExpenses) || 0);
  const safeRenderNetIncome = Number(financialData?.netIncome) || 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* الهيدر الفاخر والأيقونة الـ 3D */}
      <View style={styles.headerBanner}>
        <Luxury3DReportsIcon />
        <Text style={styles.headerTitle}>التقارير وقائمة الدخل</Text>
      </View>

      {/* شريط اختيار وتنقل الشهر الفاخر */}
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>الملخص المالي لشهر {selectedMonth}</Text>
          
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
                <Text style={styles.netIncomeTitle}>صافي الدخل للشهر المختار</Text>
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
          <Text style={styles.sectionTitle}>عمليات شهر {selectedMonth}</Text>
          {(!Array.isArray(reportDetails) || reportDetails.length === 0) ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>لا توجد حركات مسجلة في هذا الشهر لعرضها</Text>
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
  container: { flex: 1, backgroundColor: '#F0F4F9' },
  scrollContent: { paddingBottom: 30 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4F9', gap: 12 },
  loaderText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  
  // الهيدر والأيقونة الـ 3D
  headerBanner: {
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  iconWrapper: {
    marginVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon3DOuter: {
    width: 76,
    height: 76,
    borderRadius: 24,
    padding: 4,
    backgroundColor: '#3B82F6',
    borderColor: '#93C5FD',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  icon3DInner: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 36 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 6,
  },

  // شريط اختيار الشهر
  monthSelectorBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
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
  monthLabelText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  monthValueText: { fontSize: 16, color: '#0F172A', fontWeight: 'bold' },

  // الأقسام والبطاقات
  sectionContainer: { paddingHorizontal: 15, marginTop: 15 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', textAlign: 'right', marginBottom: 10 },
  summaryGrid: { flexDirection: 'row-reverse', gap: 10, marginBottom: 10 },
  card: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2, alignItems: 'flex-start' },
  salesCard: { borderRightWidth: 4, borderRightColor: '#10B981' },
  expensesCard: { borderRightWidth: 4, borderRightColor: '#EF4444' },
  cardIcon: { fontSize: 22, marginBottom: 4 },
  largeIcon: { fontSize: 28 },
  cardTitle: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 4 },
  cardValue: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  currency: { fontSize: 11, fontWeight: '400', color: '#64748B' },
  netIncomeCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRightWidth: 4, borderRightColor: '#2563EB', elevation: 2 },
  netIncomeHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  netIncomeTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', textAlign: 'right' },
  netIncomeSubtitle: { fontSize: 11, color: '#64748B', textAlign: 'right', marginTop: 2 },
  netIncomeValue: { fontSize: 20, fontWeight: '800', textAlign: 'right', marginTop: 6 },
  currencyLarge: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  exportButtonsRow: { flexDirection: 'row-reverse', gap: 10 },
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
