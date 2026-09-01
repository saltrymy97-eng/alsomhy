import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import db from '../db';

export default function TreasuryScreen() {
  const [cashBalance, setCashBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [transactionType, setTransactionType] = useState('deposit'); // deposit, withdraw, transfer
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const setup = async () => {
      await initDB();
      await fetchData();
    };
    setup();
  }, [selectedMonth, selectedDate]);

  const changeMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const newMonthStr = date.toISOString().slice(0, 7);
    setSelectedMonth(newMonthStr);
    setSelectedDate(`${newMonthStr}-01`);
  };

  // تهيئة الجداول في قاعدة البيانات بشكل لامتزامن
  const initDB = async () => {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS treasury_balances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cash_balance REAL DEFAULT 0,
          bank_balance REAL DEFAULT 0
        );
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS treasury_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // إضافة السجل الأولي للأرصدة إذا لم يكن موجوداً
      const result = await db.query('SELECT * FROM treasury_balances;');
      if (!result || result.length === 0) {
        await db.query('INSERT INTO treasury_balances (cash_balance, bank_balance) VALUES (0, 0);');
      }
    } catch (error) {
      console.error('خطأ في تهيئة قاعدة البيانات:', error);
    }
  };

  // جلب البيانات والأرصدة من قاعدة البيانات المفلترة
  const fetchData = async () => {
    try {
      const balanceRes = await db.query('SELECT * FROM treasury_balances LIMIT 1;');
      if (balanceRes && balanceRes.length > 0) {
        setCashBalance(balanceRes[0].cash_balance || 0);
        setBankBalance(balanceRes[0].bank_balance || 0);
      }

      // جلب الحركات للفي التصفية التاريخية
      const txRes = await db.query(
        `SELECT * FROM treasury_transactions 
         WHERE strftime('%Y-%m', created_at) = ? 
         ORDER BY id DESC;`,
        [selectedMonth]
      );
      setTransactions(txRes || []);
    } catch (error) {
      console.error('خطأ في جلب البيانات:', error);
    }
  };

  // معالجة حفظ الحركة النقدية
  const handleSaveTransaction = async () => {
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال وصف أو بيان للحركة.');
      return;
    }

    let newCash = cashBalance;
    let newBank = bankBalance;

    if (transactionType === 'deposit') {
      newCash += numAmount;
    } else if (transactionType === 'withdraw') {
      if (numAmount > cashBalance) {
        Alert.alert('خطأ', 'رصيد الصندوق الحالي لا يكفي لإتمام عملية السحب.');
        return;
      }
      newCash -= numAmount;
    } else if (transactionType === 'transfer') {
      if (numAmount > cashBalance) {
        Alert.alert('خطأ', 'رصيد الصندوق لا يكفي لإجراء التحويل للبنك.');
        return;
      }
      newCash -= numAmount;
      newBank += numAmount;
    }

    try {
      // تحديث الأرصدة وإدراج الحركة
      await db.query(
        'UPDATE treasury_balances SET cash_balance = ?, bank_balance = ? WHERE id = 1;',
        [newCash, newBank]
      );

      const timestamp = `${selectedDate} ${new Date().toTimeString().slice(0, 8)}`;

      await db.query(
        'INSERT INTO treasury_transactions (type, amount, description, created_at) VALUES (?, ?, ?, ?);',
        [transactionType, numAmount, description.trim(), timestamp]
      );

      // إعادة تصفير الحقول وإعادة جلب البيانات
      setAmount('');
      setDescription('');
      Keyboard.dismiss();
      await fetchData();

      Alert.alert('نجاح', 'تم تسجيل الحركة النقدية بنجاح.');
    } catch (error) {
      console.error('خطأ في حفظ الحركة:', error);
      Alert.alert('خطأ', 'تعذر حفظ العملية في قاعدة البيانات.');
    }
  };

  // تنسيق نصوص ونقاط نوع الحركة
  const getTransactionBadge = (type) => {
    switch (type) {
      case 'deposit':
        return { label: 'إيداع صندوق', color: '#10B981' };
      case 'withdraw':
        return { label: 'سحب صندوق', color: '#EF4444' };
      case 'transfer':
        return { label: 'تحويل للبنك', color: '#2563EB' };
      default:
        return { label: 'حركة نقدية', color: '#64748B' };
    }
  };

  // عنصر القائمة للحركات
  const renderTransactionItem = ({ item }) => {
    const badge = getTransactionBadge(item.type);

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyRight}>
          <View style={styles.historyDetails}>
            <Text style={styles.historyDescription}>{item.description}</Text>
            <Text style={styles.historyDate}>{item.created_at}</Text>
          </View>
        </View>
        <View style={styles.historyLeft}>
          <Text style={[styles.historyAmount, { color: badge.color }]}>
            {(item.amount || 0).toLocaleString()} ر.ي
          </Text>
          <Text style={styles.historyTypeLabel}>{badge.label}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          
          {/* شريط اختيار وتنقل الشهر المفلتر */}
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

          {/* 1. الأرصدة العلوية */}
          <View style={styles.balancesContainer}>
            <View style={[styles.balanceCard, styles.cashCard]}>
              <Text style={styles.balanceTitle}>رصيد الصندوق الحالي</Text>
              <Text style={styles.balanceValue}>{(cashBalance || 0).toLocaleString()} <Text style={styles.currency}>ر.ي</Text></Text>
            </View>

            <View style={[styles.balanceCard, styles.bankCard]}>
              <Text style={styles.balanceTitle}>رصيد البنك الحالي</Text>
              <Text style={styles.balanceValue}>{(bankBalance || 0).toLocaleString()} <Text style={styles.currency}>ر.ي</Text></Text>
            </View>
          </View>

          {/* 2. نموذج تسجيل حركة نقدية */}
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>تسجيل حركة بتاريخ المفلتر</Text>

            <View style={styles.dateInputWrapper}>
              <Text style={styles.fieldLabel}>تاريخ العملية:</Text>
              <TextInput
                style={styles.dateInput}
                value={selectedDate}
                onChangeText={setSelectedDate}
                placeholder="YYYY-MM-DD"
              />
            </View>

            {/* أزرار التبديل */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, transactionType === 'deposit' && styles.activeDeposit]}
                onPress={() => setTransactionType('deposit')}
              >
                <Text style={[styles.toggleText, transactionType === 'deposit' && styles.activeToggleText]}>إيداع</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleButton, transactionType === 'withdraw' && styles.activeWithdraw]}
                onPress={() => setTransactionType('withdraw')}
              >
                <Text style={[styles.toggleText, transactionType === 'withdraw' && styles.activeToggleText]}>سحب</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleButton, transactionType === 'transfer' && styles.activeTransfer]}
                onPress={() => setTransactionType('transfer')}
              >
                <Text style={[styles.toggleText, transactionType === 'transfer' && styles.activeToggleText]}>تحويل للبنك</Text>
              </TouchableOpacity>
            </View>

            {/* الإدخالات */}
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="المبلغ (ر.ي)"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <TextInput
                style={styles.input}
                placeholder="البيان / الوصف (مثال: إيراد مبيعات، مصروف...)"
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* زر الحفظ */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveTransaction} activeOpacity={0.8}>
              <Text style={styles.saveButtonText}>حفظ وتوثيق العملية</Text>
            </TouchableOpacity>
          </View>

          {/* 3. سجل الحركات النقدية */}
          <View style={styles.historyContainer}>
            <Text style={styles.sectionTitle}>سجل حركات شهر {selectedMonth}</Text>
            <FlatList
              data={transactions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderTransactionItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>لا توجد حركات نقدية مسجلة في هذا الشهر</Text>
                </View>
              }
            />
          </View>

        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
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
    justify.content: 'center', // Note: Correct property below in code logic
    alignContent: 'center',
    justifyContent: 'center'
  },
  monthNavText: { fontSize: 14, color: '#334155', fontWeight: 'bold' },
  monthDisplayContainer: { alignItems: 'center' },
  monthLabelText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  monthValueText: { fontSize: 15, color: '#0F172A', fontWeight: 'bold' },

  balancesContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 10,
    gap: 10,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cashCard: {
    borderRightWidth: 4,
    borderRightColor: '#10B981',
  },
  bankCard: {
    borderRightWidth: 4,
    borderRightColor: '#2563EB',
  },
  balanceTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    textAlign: 'right',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'right',
  },
  currency: {
    fontSize: 11,
    fontWeight: 'normal',
    color: '#64748B',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'right',
    marginBottom: 8,
  },
  dateInputWrapper: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 3,
    textAlign: 'right',
  },
  dateInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 6,
    fontSize: 13,
    color: '#0F172A',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeDeposit: {
    backgroundColor: '#10B981',
  },
  activeWithdraw: {
    backgroundColor: '#EF4444',
  },
  activeTransfer: {
    backgroundColor: '#2563EB',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  activeToggleText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  inputGroup: {
    gap: 8,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    textAlign: 'right',
  },
  saveButton: {
    backgroundColor: '#0F172A',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: 15,
    marginTop: 10,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
  },
  historyDetails: {
    alignItems: 'flex-start',
    flex: 1,
  },
  historyDescription: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
  },
  historyDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  historyLeft: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  historyTypeLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
