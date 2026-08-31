import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing
} from 'react-native';
import db from '../db';

// ==========================================
// 💎 المكون التفاعلي: الأيقونة الـ 3D المتحركة والفاخرة
// ==========================================
const Luxury3DLogIcon = () => {
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
          <Text style={styles.iconEmoji}>📊</Text>
        </View>
      </Animated.View>
    </View>
  );
};

export default function DailyLogScreen() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [logsList, setLogsList] = useState([]);
  
  const [monthlySummary, setMonthlySummary] = useState({
    sales: 0,
    purchases: 0,
    profit: 0
  });

  useEffect(() => {
    initTableAndFetch();
  }, [selectedMonth]);

  const initTableAndFetch = async () => {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS daily_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          time TEXT,
          total_purchases REAL DEFAULT 0,
          total_sales REAL DEFAULT 0,
          net_profit REAL DEFAULT 0
        );
      `);
      await fetchLogsAndSummary();
    } catch (error) {
      console.error('خطأ في تهيئة جدول الحركات اليومية:', error);
    }
  };

  const fetchLogsAndSummary = async () => {
    try {
      // 1. جلب حركات الشهر المحدد
      const results = await db.query(
        `SELECT * FROM daily_transactions 
         WHERE strftime('%Y-%m', date) = ? 
         ORDER BY id DESC;`,
        [selectedMonth]
      );
      setLogsList(results || []);

      // 2. حساب إجمالي مجاميع الشهر (المبيعات، المشتريات، صافي الأرباح)
      const summary = await db.query(
        `SELECT 
           COALESCE(SUM(total_sales), 0) as totalSales, 
           COALESCE(SUM(total_purchases), 0) as totalPurchases, 
           COALESCE(SUM(net_profit), 0) as totalProfit 
         FROM daily_transactions 
         WHERE strftime('%Y-%m', date) = ?;`,
        [selectedMonth]
      );

      if (summary && summary[0]) {
        setMonthlySummary({
          sales: summary[0].totalSales,
          purchases: summary[0].totalPurchases,
          profit: summary[0].totalProfit
        });
      }
    } catch (error) {
      console.error('خطأ في جلب حركات اليومية والملخص:', error);
    }
  };

  const changeMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const handleSaveTransaction = async () => {
    if (!purchaseAmount && !saleAmount) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ الشراء أو مبلغ البيع على الأقل');
      return;
    }

    const pAmount = parseFloat(purchaseAmount) || 0;
    const sAmount = parseFloat(saleAmount) || 0;
    const netProfit = sAmount - pAmount; 
    const currentTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    try {
      await db.query(
        'INSERT INTO daily_transactions (date, time, total_purchases, total_sales, net_profit) VALUES (?, ?, ?, ?, ?);',
        [transactionDate, currentTime, pAmount, sAmount, netProfit]
      );

      setPurchaseAmount('');
      setSaleAmount('');
      await fetchLogsAndSummary();
      Alert.alert('نجاح', 'تم تسجيل الحركة المالية بنجاح ⚡');
    } catch (error) {
      console.error('خطأ في حفظ العملية:', error);
      Alert.alert('خطأ', 'فشل حفظ الحركة في قاعدة البيانات.');
    }
  };

  const renderLogItem = ({ item }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeaderRow}>
        <Text style={styles.logDateText}>🗓️ {item.date}</Text>
        <Text style={styles.logTime}>{item.time || ''}</Text>
      </View>

      <View style={styles.logRow}>
        <Text style={styles.logLabel}>المبيعات: <Text style={styles.textBlue}>{(item.total_sales || 0).toLocaleString()} ريال</Text></Text>
        <Text style={styles.logLabel}>المشتريات: <Text style={styles.textRed}>{(item.total_purchases || 0).toLocaleString()} ريال</Text></Text>
      </View>

      <View style={styles.logFooter}>
        <Text style={styles.logNetTitle}>صافي الربح / الخسارة:</Text>
        <Text style={[(item.net_profit || 0) >= 0 ? styles.textGreen : styles.textRed, styles.logNetValue]}>
          {(item.net_profit || 0).toLocaleString()} ريال
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* الهيدر الفاخر والأيقونة الـ 3D */}
      <View style={styles.headerBanner}>
        <Luxury3DLogIcon />
        <Text style={styles.headerTitle}>سجل الحركات اليومية</Text>
      </View>

      {/* شريط اختيار وتنقل الشهر الفاخر */}
      <View style={styles.monthSelectorBar}>
        <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(-1)}>
          <Text style={styles.monthNavText}>▶</Text>
        </TouchableOpacity>
        
        <View style={styles.monthDisplayContainer}>
          <Text style={styles.monthLabelText}>حركات شهر:</Text>
          <Text style={styles.monthValueText}>{selectedMonth}</Text>
        </View>

        <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(1)}>
          <Text style={styles.monthNavText}>◀</Text>
        </TouchableOpacity>
      </View>

      {/* بطاقة الإحصائيات الشهرية التراكمية */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryBox, styles.borderBlue]}>
          <Text style={styles.summaryBoxLabel}>إجمالي المبيعات</Text>
          <Text style={[styles.summaryBoxValue, styles.textBlue]}>{monthlySummary.sales.toLocaleString()}</Text>
        </View>

        <View style={[styles.summaryBox, styles.borderRed]}>
          <Text style={styles.summaryBoxLabel}>إجمالي المشتريات</Text>
          <Text style={[styles.summaryBoxValue, styles.textRed]}>{monthlySummary.purchases.toLocaleString()}</Text>
        </View>

        <View style={[styles.summaryBox, styles.borderGreen]}>
          <Text style={styles.summaryBoxLabel}>صافي الشهر</Text>
          <Text style={[styles.summaryBoxValue, monthlySummary.profit >= 0 ? styles.textGreen : styles.textRed]}>
            {monthlySummary.profit.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* قسم الإدخال السريع */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>تسجيل حركة جديدة</Text>
        
        <TextInput
          style={[styles.input, { marginBottom: 12 }]}
          placeholder="التاريخ (YYYY-MM-DD)"
          placeholderTextColor="#94A3B8"
          value={transactionDate}
          onChangeText={setTransactionDate}
        />

        <View style={styles.inputRow}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>مبلغ البيع (ريال)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              value={saleAmount}
              onChangeText={setSaleAmount}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>مبلغ الشراء (ريال)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              value={purchaseAmount}
              onChangeText={setPurchaseAmount}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveTransaction}>
          <Text style={styles.saveButtonText}>حفظ وتوثيق الحركة 💾</Text>
        </TouchableOpacity>
      </View>

      {/* قسم سجل اليومية */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>عمليات شهر {selectedMonth}</Text>
        <FlatList
          data={logsList}
          keyExtractor={item => item.id.toString()}
          renderItem={renderLogItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyText}>لم يتم تسجيل أي عمليات في هذا الشهر.</Text>}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F9' },

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
    backgroundColor: '#10B981',
    borderColor: '#A7F3D0',
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
    backgroundColor: '#047857',
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

  // كروت الملخص المالي الثلاثي
  summaryContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 14,
    marginHorizontal: 3,
    alignItems: 'center',
    borderTopWidth: 4,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  borderBlue: { borderTopColor: '#3B82F6' },
  borderRed: { borderTopColor: '#EF4444' },
  borderGreen: { borderTopColor: '#10B981' },
  summaryBoxLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  summaryBoxValue: { fontSize: 14, fontWeight: '900' },

  // قسم الإدخال
  inputSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    padding: 15,
    borderRadius: 16,
    marginBottom: 15,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  inputContainer: { width: '48%' },
  inputLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  // القائمة والبطاقات
  listSection: { flex: 1, paddingHorizontal: 15 },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderRightWidth: 5,
    borderRightColor: '#10B981',
  },
  logHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  logDateText: { fontSize: 13, color: '#334155', fontWeight: 'bold' },
  logTime: { fontSize: 12, color: '#94A3B8' },
  logRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  logFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  logNetTitle: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  logNetValue: { fontSize: 15, fontWeight: '900' },
  textBlue: { color: '#2563EB' },
  textRed: { color: '#EF4444' },
  textGreen: { color: '#10B981' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 25, fontSize: 14 },
});
