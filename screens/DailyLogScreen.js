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
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('accounting.db');

export default function DailyLogScreen() {
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [todayLogs, setTodayLogs] = useState([]);

  useEffect(() => {
    initTableAndFetch();
  }, []);

  const initTableAndFetch = () => {
    try {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS daily_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT DEFAULT (date('now')),
          time TEXT,
          total_purchases REAL,
          total_sales REAL,
          net_profit REAL
        );
      `);
      fetchTodayLogs();
    } catch (error) {
      console.error('خطأ في تهيئة جدول الحركات اليومية:', error);
    }
  };

  const fetchTodayLogs = () => {
    try {
      const results = db.getAllSync(
        `SELECT * FROM daily_transactions WHERE date = date('now') ORDER BY id DESC;`
      );
      setTodayLogs(results);
    } catch (error) {
      console.error('خطأ في جلب حركات اليوم:', error);
    }
  };

  const handleSaveTransaction = () => {
    if (!purchaseAmount && !saleAmount) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ الشراء أو مبلغ البيع على الأقل');
      return;
    }

    const pAmount = parseFloat(purchaseAmount) || 0;
    const sAmount = parseFloat(saleAmount) || 0;
    const netProfit = sAmount - pAmount; 
    const currentTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    try {
      db.runSync(
        'INSERT INTO daily_transactions (date, time, total_purchases, total_sales, net_profit) VALUES (date("now"), ?, ?, ?, ?);',
        [currentTime, pAmount, sAmount, netProfit]
      );

      setPurchaseAmount('');
      setSaleAmount('');
      fetchTodayLogs();
      Alert.alert('نجاح', 'تم تسجيل العملية بنجاح');
    } catch (error) {
      console.error('خطأ في حفظ العملية:', error);
      Alert.alert('خطأ', 'فشل حفظ الحركة في قاعدة البيانات.');
    }
  };

  const renderLogItem = ({ item }) => (
    <View style={styles.logCard}>
      <View style={styles.logRow}>
        <Text style={styles.logLabel}>المبيعات: <Text style={styles.textBlue}>{item.total_sales}</Text></Text>
        <Text style={styles.logLabel}>المشتريات: <Text style={styles.textRed}>{item.total_purchases}</Text></Text>
      </View>
      <View style={[styles.logRow, styles.logFooter]}>
        <Text style={styles.logTime}>{item.time}</Text>
        <Text style={styles.logNet}>الصافي: <Text style={item.net_profit >= 0 ? styles.textGreen : styles.textRed}>{item.net_profit}</Text></Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* قسم الإدخال السريع */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>تسجيل حركة جديدة</Text>
        
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
          <Text style={styles.saveButtonText}>حفظ العملية 💾</Text>
        </TouchableOpacity>
      </View>

      {/* قسم سجل اليوم */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>سجل عمليات اليوم</Text>
        <FlatList
          data={todayLogs}
          keyExtractor={item => item.id.toString()}
          renderItem={renderLogItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyText}>لم يتم تسجيل أي عمليات اليوم بعد.</Text>}
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
  inputSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 15,
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  inputContainer: {
    width: '48%',
  },
  inputLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 15,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderRightWidth: 4,
    borderRightColor: '#E2E8F0',
  },
  logRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  logFooter: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginBottom: 0,
  },
  logLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  logTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  logNet: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  textBlue: { color: '#3B82F6' },
  textRed: { color: '#EF4444' },
  textGreen: { color: '#10B981' },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
    fontSize: 14,
  }
});
