import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import db from '../db';

export default function TreasuryScreen() {
  // حالة الأرصدة
  const [balances, setBalances] = useState({ cash: 0, bank: 0 });
  const [balanceId, setBalanceId] = useState(null);

  // حالة نموذج الإدخال
  const [selectedAccount, setSelectedAccount] = useState('cash'); // 'cash' | 'bank'
  const [transactionType, setTransactionType] = useState('deposit'); // 'deposit' | 'withdraw' | 'transfer'
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  // تواريخ
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // حالة سجل الحركات
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    loadBalances();
    loadTransactions();
  }, [selectedMonth]);

  // ==========================================
  // دوال قاعدة البيانات
  // ==========================================
  const loadBalances = async () => {
    try {
      const res = await db.getAll('SELECT * FROM treasury_balances LIMIT 1;');
      if (res && res.length > 0) {
        setBalances({
          cash: res[0].cash_balance || 0,
          bank: res[0].bank_balance || 0,
        });
        setBalanceId(res[0].id);
      } else {
        // إنشاء السجل الافتراضي في حال عدم وجوده
        await db.run('INSERT INTO treasury_balances (cash_balance, bank_balance) VALUES (0, 0);');
        const newRes = await db.getAll('SELECT * FROM treasury_balances LIMIT 1;');
        if (newRes && newRes.length > 0) {
          setBalances({ cash: 0, bank: 0 });
          setBalanceId(newRes[0].id);
        }
      }
    } catch (error) {
      console.error('خطأ في جلب الأرصدة:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      const query = `
        SELECT * FROM treasury_transactions 
        WHERE strftime('%Y-%m', created_at) = ? 
        ORDER BY created_at DESC, id DESC;
      `;
      const res = await db.getAll(query, [selectedMonth]);
      setTransactions(res || []);
    } catch (error) {
      console.error('خطأ في جلب الحركات:', error);
    }
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount);

    // 1. التحقق من صحة المدخلات الأساسية
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('تنبيه', 'الرجاء إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('تنبيه', 'الرجاء إدخال سبب العملية (البيان).');
      return;
    }
    if (!selectedDate.trim()) {
      Alert.alert('تنبيه', 'تاريخ العملية مطلوب.');
      return;
    }

    let currentCash = balances.cash;
    let currentBank = balances.bank;
    let finalType = '';

    // 2. معالجة المنطق بناءً على الحساب ونوع العملية
    if (selectedAccount === 'cash') {
      if (transactionType === 'deposit') {
        currentCash += numAmount;
        finalType = 'cash_deposit';
      } else if (transactionType === 'withdraw') {
        if (numAmount > currentCash) {
          Alert.alert('خطأ', 'رصيد الصندوق غير كافٍ لهذه العملية.');
          return;
        }
        currentCash -= numAmount;
        finalType = 'cash_withdraw';
      } else if (transactionType === 'transfer') {
        if (numAmount > currentCash) {
          Alert.alert('خطأ', 'رصيد الصندوق غير كافٍ للتحويل.');
          return;
        }
        currentCash -= numAmount;
        currentBank += numAmount;
        finalType = 'cash_to_bank';
      }
    } else if (selectedAccount === 'bank') {
      if (transactionType === 'deposit') {
        currentBank += numAmount;
        finalType = 'bank_deposit';
      } else if (transactionType === 'withdraw') {
        if (numAmount > currentBank) {
          Alert.alert('خطأ', 'رصيد البنك غير كافٍ لهذه العملية.');
          return;
        }
        currentBank -= numAmount;
        finalType = 'bank_withdraw';
      } else if (transactionType === 'transfer') {
        if (numAmount > currentBank) {
          Alert.alert('خطأ', 'رصيد البنك غير كافٍ للتحويل.');
          return;
        }
        currentBank -= numAmount;
        currentCash += numAmount;
        finalType = 'bank_to_cash';
      }
    }

    // 3. الحفظ في قاعدة البيانات
    try {
      // إدراج الحركة
      await db.run(
        'INSERT INTO treasury_transactions (type, amount, description, created_at) VALUES (?, ?, ?, ?);',
        [finalType, numAmount, description.trim(), selectedDate]
      );

      // تحديث الأرصدة
      if (balanceId) {
        await db.run(
          'UPDATE treasury_balances SET cash_balance = ?, bank_balance = ? WHERE id = ?;',
          [currentCash, currentBank, balanceId]
        );
      } else {
        await db.run(
          'UPDATE treasury_balances SET cash_balance = ?, bank_balance = ?;',
          [currentCash, currentBank]
        );
      }

      Alert.alert('نجاح', 'تم حفظ العملية وتحديث الأرصدة بنجاح.');
      
      // تصفير الحقول وإعادة التحميل
      setAmount('');
      setDescription('');
      loadBalances();
      loadTransactions();
      
    } catch (error) {
      console.error('خطأ في حفظ العملية:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ العملية.');
    }
  };

  // ==========================================
  // دوال مساعدة للواجهة
  // ==========================================
  const changeMonth = (offset) => {
    let [year, month] = selectedMonth.split('-').map(Number);
    month += offset;
    if (month === 0) { month = 12; year -= 1; }
    else if (month === 13) { month = 1; year += 1; }
    setSelectedMonth(`${year}-${month.toString().padStart(2, '0')}`);
  };

  const getPlaceholderText = () => {
    if (transactionType === 'deposit') return 'سبب الإيداع (مثال: مبيعات، رأس مال...)';
    if (transactionType === 'withdraw') return 'سبب السحب (مثال: مصروف، سحب شخصي...)';
    return 'بيان التحويل';
  };

  const formatTransactionType = (type) => {
    switch (type) {
      case 'cash_deposit': return { label: 'إيداع نقدية', color: '#10B981' };
      case 'cash_withdraw': return { label: 'سحب نقدية', color: '#EF4444' };
      case 'cash_to_bank': return { label: 'تحويل نقدية ➔ بنك', color: '#3B82F6' };
      case 'bank_deposit': return { label: 'إيداع بنك', color: '#10B981' };
      case 'bank_withdraw': return { label: 'سحب بنك', color: '#EF4444' };
      case 'bank_to_cash': return { label: 'تحويل بنك ➔ نقدية', color: '#F59E0B' };
      default: return { label: 'عملية غير معروفة', color: '#64748B' };
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* ================= الأرصدة ================= */}
        <View style={styles.balancesContainer}>
          <View style={[styles.balanceCard, { borderRightColor: '#10B981' }]}>
            <Text style={styles.balanceTitle}>رصيد الصندوق</Text>
            <Text style={[styles.balanceAmount, { color: '#10B981' }]}>{balances.cash.toLocaleString()} <Text style={styles.currency}>ر.ي</Text></Text>
          </View>
          <View style={[styles.balanceCard, { borderRightColor: '#3B82F6' }]}>
            <Text style={styles.balanceTitle}>رصيد البنك</Text>
            <Text style={[styles.balanceAmount, { color: '#3B82F6' }]}>{balances.bank.toLocaleString()} <Text style={styles.currency}>ر.ي</Text></Text>
          </View>
        </View>

        {/* ================= نموذج الإدخال ================= */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>تسجيل حركة مالية</Text>

          {/* التاريخ */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>تاريخ العملية</Text>
            <TextInput
              style={styles.textInput}
              value={selectedDate}
              onChangeText={setSelectedDate}
              placeholder="YYYY-MM-DD"
            />
          </View>

          {/* اختيار الحساب */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>الحساب</Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity 
                style={[styles.segmentBtn, selectedAccount === 'cash' && styles.segmentBtnActive]}
                onPress={() => setSelectedAccount('cash')}
              >
                <Text style={[styles.segmentText, selectedAccount === 'cash' && styles.segmentTextActive]}>النقدية</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.segmentBtn, selectedAccount === 'bank' && styles.segmentBtnActive]}
                onPress={() => setSelectedAccount('bank')}
              >
                <Text style={[styles.segmentText, selectedAccount === 'bank' && styles.segmentTextActive]}>البنك</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* نوع العملية */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>نوع العملية</Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity 
                style={[styles.segmentBtn, transactionType === 'deposit' && styles.segmentBtnActiveDeposit]}
                onPress={() => setTransactionType('deposit')}
              >
                <Text style={[styles.segmentText, transactionType === 'deposit' && styles.segmentTextActiveWhite]}>إيداع</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.segmentBtn, transactionType === 'withdraw' && styles.segmentBtnActiveWithdraw]}
                onPress={() => setTransactionType('withdraw')}
              >
                <Text style={[styles.segmentText, transactionType === 'withdraw' && styles.segmentTextActiveWhite]}>سحب</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.segmentBtn, transactionType === 'transfer' && styles.segmentBtnActiveTransfer]}
                onPress={() => setTransactionType('transfer')}
              >
                <Text style={[styles.segmentText, transactionType === 'transfer' && styles.segmentTextActiveWhite]}>
                  {selectedAccount === 'cash' ? 'تحويل إلى البنك' : 'تحويل إلى النقدية'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* المبلغ */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>المبلغ</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
            />
          </View>

          {/* البيان */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>سبب العملية / البيان</Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholder={getPlaceholderText()}
            />
          </View>

          {/* زر الحفظ */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>حفظ العملية</Text>
          </TouchableOpacity>
        </View>

        {/* ================= سجل الحركات ================= */}
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>سجل الحركات</Text>
            <View style={styles.monthSelector}>
              <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthBtn}>
                <Text style={styles.monthBtnText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.monthText}>{selectedMonth}</Text>
              <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthBtn}>
                <Text style={styles.monthBtnText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {transactions.length === 0 ? (
            <Text style={styles.noDataText}>لا توجد حركات مسجلة في هذا الشهر.</Text>
          ) : (
            transactions.map((item) => {
              const typeInfo = formatTransactionType(item.type);
              return (
                <View key={item.id.toString()} style={styles.transactionCard}>
                  <View style={styles.transactionRow}>
                    <View style={styles.transactionRight}>
                      <Text style={[styles.transactionType, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                      <Text style={styles.transactionDesc}>{item.description}</Text>
                    </View>
                    <View style={styles.transactionLeft}>
                      <Text style={styles.transactionAmount}>
                        {item.amount.toLocaleString()} <Text style={styles.currencySmall}>ر.ي</Text>
                      </Text>
                      <Text style={styles.transactionDate}>{item.created_at}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  // الأرصدة
  balancesContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 20, gap: 12 },
  balanceCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#E2E8F0', borderRightWidth: 4,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    alignItems: 'flex-end'
  },
  balanceTitle: { fontSize: 13, color: '#64748B', fontWeight: '700', marginBottom: 6 },
  balanceAmount: { fontSize: 18, fontWeight: 'bold' },
  currency: { fontSize: 11, fontWeight: 'normal' },

  // النموذج
  formContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 16, textAlign: 'right' },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, textAlign: 'right' },
  textInput: {
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
    paddingHorizontal: 14, height: 48, fontSize: 14, color: '#0F172A', textAlign: 'right'
  },
  
  // الأزرار المجمعة (Segmented Control)
  segmentedControl: { flexDirection: 'row-reverse', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  segmentBtnActiveDeposit: { backgroundColor: '#10B981', elevation: 2 },
  segmentBtnActiveWithdraw: { backgroundColor: '#EF4444', elevation: 2 },
  segmentBtnActiveTransfer: { backgroundColor: '#3B82F6', elevation: 2 },
  segmentText: { fontSize: 13, fontWeight: 'bold', color: '#64748B' },
  segmentTextActive: { color: '#0F172A' },
  segmentTextActiveWhite: { color: '#FFFFFF' },

  saveButton: { backgroundColor: '#1E293B', borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  // السجل
  historyContainer: { flex: 1 },
  historyHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthSelector: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  monthBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  monthBtnText: { fontSize: 16, color: '#64748B', fontWeight: 'bold' },
  monthText: { fontSize: 14, fontWeight: 'bold', color: '#0F172A', paddingHorizontal: 8 },
  
  noDataText: { textAlign: 'center', color: '#94A3B8', marginTop: 20, fontSize: 14 },
  
  transactionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  transactionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  transactionRight: { flex: 1, alignItems: 'flex-end', paddingLeft: 10 },
  transactionLeft: { alignItems: 'flex-start' },
  transactionType: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  transactionDesc: { fontSize: 13, color: '#475569', textAlign: 'right' },
  transactionAmount: { fontSize: 15, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  transactionDate: { fontSize: 11, color: '#94A3B8' },
  currencySmall: { fontSize: 10, fontWeight: 'normal', color: '#64748B' },
});
