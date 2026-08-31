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
const Luxury3DIcon = ({ activeTab }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // حركة طفو حركية 3D مستمرة
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

    // حركة نَبض فخمة للبريق الداخلي
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

  const isCustomer = activeTab === 'customer';

  return (
    <View style={styles.iconWrapper}>
      <Animated.View 
        style={[
          styles.icon3DOuter,
          isCustomer ? styles.goldGlowBlue : styles.goldGlowPurple,
          {
            transform: [
              { translateY: floatAnim },
              { scale: pulseAnim }
            ]
          }
        ]}
      >
        <View style={[styles.icon3DInner, isCustomer ? styles.innerBlueGrad : styles.innerPurpleGrad]}>
          <Text style={styles.iconEmoji}>{isCustomer ? '💎' : '👑'}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

export default function ContactsScreen() {
  const [activeTab, setActiveTab] = useState('customer');
  // الشهر المحدد بصيغة YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [name, setName] = useState('');
  const [amountDue, setAmountDue] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [contactsList, setContactsList] = useState([]);
  const [totalMonthAmount, setTotalMonthAmount] = useState(0);

  useEffect(() => {
    initTableAndFetch();
  }, [activeTab, selectedMonth]);

  const initTableAndFetch = async () => {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS contacts_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          type TEXT NOT NULL
        );
      `);
      await fetchContacts();
    } catch (error) {
      console.error('خطأ في تهيئة جدول الديون والمستحقات:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      // 1. جلب سجلات الشهر المحدد ونوع الحساب (عميل/مورد)
      const results = await db.query(
        `SELECT * FROM contacts_ledger 
         WHERE type = ? AND strftime('%Y-%m', date) = ? 
         ORDER BY id DESC;`,
        [activeTab, selectedMonth]
      );
      setContactsList(results || []);

      // 2. حساب المجموع الشهري الإجمالي
      const summary = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM contacts_ledger 
         WHERE type = ? AND strftime('%Y-%m', date) = ?;`,
        [activeTab, selectedMonth]
      );
      setTotalMonthAmount(summary && summary[0] ? summary[0].total : 0);
    } catch (error) {
      console.error('خطأ في جلب السجلات:', error);
    }
  };

  const changeMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const handleSaveContact = async () => {
    if (!name || !amountDue || !dueDate) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم الطرف، المبلغ، وتاريخ الاستحقاق.');
      return;
    }

    try {
      const numAmount = parseFloat(amountDue);
      await db.query(
        'INSERT INTO contacts_ledger (name, amount, date, type) VALUES (?, ?, ?, ?);',
        [name, numAmount, dueDate, activeTab]
      );

      setName('');
      setAmountDue('');
      await fetchContacts();
    } catch (error) {
      console.error('خطأ في حفظ السجل:', error);
      Alert.alert('خطأ', 'فشل حفظ السجل في قاعدة البيانات.');
    }
  };

  const renderContactItem = ({ item }) => (
    <View style={[styles.card, activeTab === 'customer' ? styles.borderBlue : styles.borderPurple]}>
      <View style={styles.cardHeader}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.dueDateText}>🗓️ {item.date}</Text>
      </View>
      
      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>
          {activeTab === 'customer' ? 'المبلغ المطلوب منه:' : 'المبلغ المستحق له:'}
        </Text>
        <Text style={[styles.amountText, activeTab === 'customer' ? styles.textBlue : styles.textPurple]}>
          {(item.amount || 0).toLocaleString()} ريال
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
        <Luxury3DIcon activeTab={activeTab} />
        <Text style={styles.headerTitle}>إدارة الديون والحسابات</Text>
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

      {/* شريط التبديل بين العملاء والموردين */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'customer' && styles.activeTabBlue]} 
          onPress={() => setActiveTab('customer')}
        >
          <Text style={[styles.tabText, activeTab === 'customer' && styles.activeTabText]}>العملاء (ديون)</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'supplier' && styles.activeTabPurple]} 
          onPress={() => setActiveTab('supplier')}
        >
          <Text style={[styles.tabText, activeTab === 'supplier' && styles.activeTabText]}>الموردين (مستحقات)</Text>
        </TouchableOpacity>
      </View>

      {/* بطاقة الإحصائية الشهرية التراكمية */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          {activeTab === 'customer' ? `إجمالي ديون العملاء لشهر (${selectedMonth})` : `إجمالي مستحقات الموردين لشهر (${selectedMonth})`}
        </Text>
        <Text style={[styles.summaryValue, activeTab === 'customer' ? styles.textBlue : styles.textPurple]}>
          {totalMonthAmount.toLocaleString()} ريال
        </Text>
      </View>

      {/* قسم الإدخال */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>
          {activeTab === 'customer' ? 'إضافة دين جديد' : 'إضافة مستحق جديد'}
        </Text>

        <TextInput
          style={[styles.input, { marginBottom: 10 }]}
          placeholder={activeTab === 'customer' ? 'اسم العميل' : 'اسم المورد'}
          placeholderTextColor="#94A3B8"
          value={name}
          onChangeText={setName}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginLeft: 10 }]}
            placeholder="التاريخ (YYYY-MM-DD)"
            placeholderTextColor="#94A3B8"
            value={dueDate}
            onChangeText={setDueDate}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="numeric"
            placeholder="المبلغ (ريال)"
            placeholderTextColor="#94A3B8"
            value={amountDue}
            onChangeText={setAmountDue}
          />
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, activeTab === 'customer' ? styles.bgBlue : styles.bgPurple]} 
          onPress={handleSaveContact}
        >
          <Text style={styles.saveButtonText}>حفظ وتوثيق السجل ⚡</Text>
        </TouchableOpacity>
      </View>

      {/* قائمة العرض الفاخرة */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>
          {activeTab === 'customer' ? `ديون العملاء لشهر ${selectedMonth}` : `مستحقات الموردين لشهر ${selectedMonth}`}
        </Text>
        <FlatList
          data={contactsList}
          keyExtractor={item => item.id.toString()}
          renderItem={renderContactItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>لا توجد سجلات مسجلة لهذا الشهر.</Text>
          }
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  goldGlowBlue: {
    backgroundColor: '#3B82F6',
    borderColor: '#93C5FD',
    borderWidth: 2,
  },
  goldGlowPurple: {
    backgroundColor: '#6366F1',
    borderColor: '#C7D2FE',
    borderWidth: 2,
  },
  icon3DInner: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerBlueGrad: { backgroundColor: '#1E40AF' },
  innerPurpleGrad: { backgroundColor: '#3730A3' },
  iconEmoji: { fontSize: 36 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 6,
  },

  // شريط اختيارات الشهر
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

  // الأزرار والتنقّلات
  tabContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FFFFFF',
    padding: 10,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeTabBlue: { backgroundColor: '#3B82F6', borderColor: '#2563EB' },
  activeTabPurple: { backgroundColor: '#6366F1', borderColor: '#4F46E5' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  activeTabText: { color: '#FFFFFF' },

  // بطاقة الملخص
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryLabel: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 5 },
  summaryValue: { fontSize: 22, fontWeight: '900' },

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
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  saveButton: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  bgBlue: { backgroundColor: '#3B82F6' },
  bgPurple: { backgroundColor: '#6366F1' },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },

  // القائمة والبطاقات
  listSection: { flex: 1, paddingHorizontal: 15 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderRightWidth: 5,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  borderBlue: { borderRightColor: '#3B82F6' },
  borderPurple: { borderRightColor: '#6366F1' },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  contactName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  dueDateText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  cardDetails: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  detailText: { fontSize: 14, color: '#64748B' },
  amountText: { fontSize: 16, fontWeight: 'bold' },
  textBlue: { color: '#2563EB' },
  textPurple: { color: '#4F46E5' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 25, fontSize: 14 },
});
