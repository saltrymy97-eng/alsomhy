import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Easing,
  Platform,
} from 'react-native';
import db from '../db';

// ==========================================
// 💎 المكون التفاعلي: الأيقونة الـ 3D المتحركة والفاخرة للخزينة
// ==========================================
const Luxury3DTreasuryIcon = () => {
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
          <Text style={styles.iconEmoji}>🏦</Text>
        </View>
      </Animated.View>
    </View>
  );
};

export default function TreasuryScreen() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [cashBalance, setCashBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [transactionType, setTransactionType] = useState('deposit'); // deposit, withdraw, transfer
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const setup = async () => {
      await initDB();
      await fetchData();
    };
    setup();
  }, [selectedMonth]);

  // التنقل بين الأشهُر
  const changeMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
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

  // جلب البيانات والأرصدة والحركات المفلترة شهرياً
  const fetchData = async () => {
    try {
      const balanceRes = await db.query('SELECT * FROM treasury_balances LIMIT 1;');
      if (balanceRes && balanceRes.length > 0) {
        setCashBalance(balanceRes[0].cash_balance || 0);
        setBankBalance(balanceRes[0].bank_balance || 0);
      }

      const txRes = await db.query(
        `SELECT * FROM treasury_transactions WHERE strftime('%Y-%m', created_at) = ? ORDER BY id DESC;`,
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

      await db.query(
        'INSERT INTO treasury_transactions (type, amount, description) VALUES (?, ?, ?);',
        [transactionType, numAmount, description.trim()]
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
        return { label: 'إيداع صندوق', color: '#10B981', emoji: '📥' };
      case 'withdraw':
        return { label: 'سحب صندوق', color: '#EF4444', emoji: '📤' };
      case 'transfer':
        return { label: 'تحويل للبنك', color: '#3B82F6', emoji: '🔀' };
      default:
        return { label: 'حركة نقدية', color: '#64748B', emoji: '📌' };
    }
  };

  // عنصر القائمة للحركات
  const renderTransactionItem = ({ item }) => {
    const badge = getTransactionBadge(item.type);
    const formattedDate = new Date(item.created_at).toLocaleString('ar-YE', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyRight}>
          <Text style={styles.historyEmoji}>{badge.emoji}</Text>
          <View style={styles.historyDetails}>
            <Text style={styles.historyDescription}>{item.description}</Text>
            <Text style={styles.historyDate}>{formattedDate}</Text>
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* 1. الهيدر الفاخر والأيقونة الـ 3D */}
      <View style={styles.headerBanner}>
        <Luxury3DTreasuryIcon />
        <Text style={styles.headerTitle}>إدارة النقدية والخزينة</Text>
      </View>

      {/* 2. شريط اختيار وتنقل الشهر الفاخر */}
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

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          
          {/* 3. الأرصدة العلوية */}
          <View style={styles.balancesContainer}>
            <View style={[styles.balanceCard, styles.cashCard]}>
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceIcon}>💵</Text>
                <Text style={styles.balanceTitle}>رصيد الصندوق</Text>
              </View>
              <Text style={styles.balanceValue}>{(cashBalance || 0).toLocaleString()} <Text style={styles.currency}>ر.ي</Text></Text>
            </View>

            <View style={[styles.balanceCard, styles.bankCard]}>
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceIcon}>🏦</Text>
                <Text style={styles.balanceTitle}>رصيد البنك</Text>
              </View>
              <Text style={styles.balanceValue}>{(bankBalance || 0).toLocaleString()} <Text style={styles.currency}>ر.ي</Text></Text>
            </View>
          </View>

          {/* 4. نموذج تسجيل حركة نقدية */}
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>تسجيل حركة نقدية جديدة</Text>

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
              <Text style={styles.saveButtonText}>✅ حفظ العملية</Text>
            </TouchableOpacity>
          </View>

          {/* 5. سجل الحركات النقدية */}
          <View style={styles.historyContainer}>
            <Text style={styles.sectionTitle}>عمليات شهر {selectedMonth}</Text>
            <FlatList
              data={transactions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderTransactionItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>📭</Text>
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
    backgroundColor: '#F0F4F9',
  },

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
    backgroundColor: '#059669',
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

  // الأرصدة
  balancesContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
    gap: 10,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cashCard: {
    borderRightWidth: 4,
    borderRightColor: '#10B981',
  },
  bankCard: {
    borderRightWidth: 4,
    borderRightColor: '#3B82F6',
  },
  balanceHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  balanceIcon: {
    fontSize: 20,
  },
  balanceTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
  },
  currency: {
    fontSize: 11,
    fontWeight: '400',
    color: '#64748B',
  },

  // النموذج
  formCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
    marginBottom: 10,
  },
  toggleContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  activeDeposit: {
    backgroundColor: '#10B981',
  },
  activeWithdraw: {
    backgroundColor: '#EF4444',
  },
  activeTransfer: {
    backgroundColor: '#3B82F6',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  activeToggleText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputGroup: {
    gap: 8,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    textAlign: 'right',
  },
  saveButton: {
    backgroundColor: '#0F172A',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // سجل الحركات
  historyContainer: {
    flex: 1,
    paddingHorizontal: 15,
    marginTop: 15,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  historyRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  historyEmoji: {
    fontSize: 22,
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
    fontWeight: '700',
  },
  historyTypeLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justify.content: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
