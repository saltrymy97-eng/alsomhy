import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import db from '../db';

export default function DailyLogScreen() {
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [logs, setLogs] = useState([]);
  const [monthTotals, setMonthTotals] = useState({ sales: 0, purchases: 0, net: 0 });

  useEffect(() => {
    initTableAndFetch();
  }, [selectedMonth, selectedDate]);

  const changeMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const newMonthStr = date.toISOString().slice(0, 7);
    setSelectedMonth(newMonthStr);
    setSelectedDate(`${newMonthStr}-01`);
  };

  const initTableAndFetch = async () => {
    try {
      // إنشاء الجدول إذا لم يكن موجوداً
      await db.query(`
        CREATE TABLE IF NOT EXISTS daily_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT DEFAULT (date('now')),
          time TEXT,
          total_purchases REAL,
          total_sales REAL,
          net_profit REAL
        );
      `);

      // إضافة عمود time بشكل آمن للقواعد القديمة لتجنب خطأ missing column time
      try {
        await db.query(`ALTER TABLE daily_transactions ADD COLUMN time TEXT;`);
      } catch (e) {
        // العمود موجود بالفعل
      }

      await fetchLogs();
    } catch (error) {
      console.error('خطأ في تهيئة جدول الحركات اليومية:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      // جلب الحركات لليوم/التاريخ المحدد
      const results = await db.query(
        `SELECT * FROM daily_transactions WHERE date = ? ORDER BY id DESC;`,
        [selectedDate]
      );
      setLogs(results || []);

      // جلب المجموع التراكمي للشهر المفلتر
      const summary = await db.query(
        `SELECT 
          COALESCE(SUM(total_sales), 0) as total_sales,
          COALESCE(SUM(total_purchases), 0) as total_purchases,
          COALESCE(SUM(net_profit), 0) as net_profit
         FROM daily_transactions 
         WHERE strftime('%Y-%m', date) = ?;`,
        [selectedMonth]
      );

      if (summary && summary[0]) {
        setMonthTotals({
          sales: summary[0].total_sales || 0,
          purchases: summary[0].total_purchases || 0,
          net: summary[0].net_profit || 0
        });
      }
    } catch (error) {
      console.error('خطأ في جلب السجلات:', error);
    }
  };

  const handleSaveTransaction = async () => {
    if (!purchaseAmount && !saleAmount) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ الشراء أو مبلغ البيع على الأقل');
      return;
    }

    const pAmount = parseFloat(purchaseAmount) || 0;
    const sAmount = parseFloat(saleAmount) || 0;
    const netProfit = sAmount - pAmount; 
    const currentTime = new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });

    try {
      await db.query(
        'INSERT INTO daily_transactions (date, time, total_purchases, total_sales, net_profit) VALUES (?, ?, ?, ?, ?);',
        [selectedDate, currentTime, pAmount, sAmount, netProfit]
      );

      setPurchaseAmount('');
      setSaleAmount('');
      await fetchLogs();
      Alert.alert('نجاح', 'تم تسجيل العملية بنجاح');
    } catch (error) {
      console.error('خطأ في حفظ العملية:', error);
      Alert.alert('خطأ', 'فشل حفظ الحركة في قاعدة البيانات.');
    }
  };

  const renderLogItem = ({ item }) => (
    <View style={styles.logCard}>
      <View style={styles.logRow}>
        <Text style={styles.logLabel}>المبيعات: <Text style={styles.textBlue}>{(item.total_sales || 0).toLocaleString()} ر.ي</Text></Text>
        <Text style={styles.logLabel}>المشتريات: <Text style={styles.textRed}>{(item.total_purchases || 0).toLocaleString()} ر.ي</Text></Text>
      </View>
      <View style={[styles.logRow, styles.logFooter]}>
        <Text style={styles.logTime}>{item.time || '--:--'}</Text>
        <Text style={styles.logNet}>
          الصافي: <Text style={(item.net_profit || 0) >= 0 ? styles.textGreen : styles.textRed}>{(item.net_profit || 0).toLocaleString()} ر.ي</Text>
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* شريط اختيار وتنقل الشهر */}
      <View style={styles.monthSelectorBar}>
        <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(-1)}>
          <Text style={styles.monthNavText}>▶</Text>
        </TouchableOpacity>

        <View style={styles.monthDisplayContainer}>
          <Text style={styles.monthLabelText}>تصفية الشهر:</Text>
          <Text style={styles.monthValueText}>{selectedMonth}</Text>
        </View>

        <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(1)}>
          <Text style={styles.monthNavText}>◀</Text>
        </TouchableOpacity>
      </View>

      {/* ملخص الشهر المفلتر */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>مبيعات الشهر</Text>
          <Text style={[styles.summaryValue, styles.textBlue]}>{monthTotals.sales.toLocaleString()} ر.ي</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>مشتريات الشهر</Text>
          <Text style={[styles.summaryValue, styles.textRed]}>{monthTotals.purchases.toLocaleString()} ر.ي</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>صافي الشهر</Text>
          <Text style={[styles.summaryValue, monthTotals.net >= 0 ? styles.textGreen : styles.textRed]}>{monthTotals.net.toLocaleString()} ر.ي</Text>
        </View>
      </View>

      {/* قسم الإدخال السريع */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>تسجيل حركة بتاريخ المفلتر</Text>
        
        <View style={styles.dateInputWrapper}>
          <Text style={styles.inputLabel}>تاريخ الحركة المحددة:</Text>
          <TextInput
            style={styles.dateInput}
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>مبلغ البيع (ريال)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0"
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
              value={purchaseAmount}
              onChangeText={setPurchaseAmount}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveTransaction}>
          <Text style={styles.saveButtonText}>حفظ وتوثيق الحركة</Text>
        </TouchableOpacity>
      </View>

      {/* قسم سجل اليوم */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>حركات تاريخ: {selectedDate}</Text>
        <FlatList
          data={logs}
          keyExtractor={item => item.id.toString()}
          renderItem={renderLogItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyText}>لا توجد حركات مسجلة لهذا التاريخ.</Text>}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
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

  summaryBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  summaryValue: { fontSize: 13, fontWeight: 'bold', marginTop: 2 },

  inputSection: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 10,
    textAlign: 'right',
  },
  dateInputWrapper: {
    marginBottom: 10,
  },
  dateInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 8,
    fontSize: 14,
    color: '#0F172A',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  inputContainer: {
    width: '48%',
  },
  inputLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 15,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderRightWidth: 4,
    borderRightColor: '#2563EB',
  },
  logRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logFooter: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
    marginBottom: 0,
  },
  logLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  logTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  logNet: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  textBlue: { color: '#2563EB' },
  textRed: { color: '#EF4444' },
  textGreen: { color: '#10B981' },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 15,
    fontSize: 13,
  }
});
