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

export default function ContactsScreen() {
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' أو 'supplier'
  const [name, setName] = useState('');
  const [amountDue, setAmountDue] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [contactsList, setContactsList] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    initTableAndFetch();
  }, [activeTab]);

  const initTableAndFetch = async () => {
    try {
      // إنشاء الجدول إذا لم يكن موجوداً
      await db.run(`
        CREATE TABLE IF NOT EXISTS contacts_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          contact_type TEXT, 
          type TEXT NOT NULL,
          amount_due REAL DEFAULT 0,
          amount REAL DEFAULT 0,
          due_date TEXT, 
          date TEXT,
          status TEXT DEFAULT 'pending',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // التأكد من وجود عمود status في الجداول القديمة
      const columns = await db.getAll(`PRAGMA table_info(contacts_ledger);`);
      const hasStatus = columns.some(column => column.name === 'status');

      if (!hasStatus) {
        await db.run(
          `ALTER TABLE contacts_ledger ADD COLUMN status TEXT DEFAULT 'pending';`
        );
      }

      await fetchContacts();
    } catch (error) {
      console.error('خطأ في تهيئة جدول الديون والمستحقات:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      // جلب جميع الديون غير المسددة مهما كان تاريخ الاستحقاق (لا تختفي بمرور الشهر)
      const results = await db.getAll(
        `SELECT * FROM contacts_ledger 
         WHERE (type = ? OR contact_type = ?) 
         AND COALESCE(status, 'pending') != 'paid' 
         ORDER BY COALESCE(due_date, date) ASC;`,
        [activeTab, activeTab]
      );
      setContactsList(results || []);

      // حساب إجمالي جميع الديون غير المسددة
      const totalResult = await db.getAll(
        `SELECT COALESCE(SUM(COALESCE(amount_due, amount)), 0) as total 
         FROM contacts_ledger 
         WHERE (type = ? OR contact_type = ?) 
         AND COALESCE(status, 'pending') != 'paid';`,
        [activeTab, activeTab]
      );
      
      setTotalAmount(Number(totalResult?.[0]?.total || 0));
    } catch (error) {
      console.error('خطأ في جلب السجلات:', error);
    }
  };

  const handleSaveContact = async () => {
    if (!name || !amountDue || !dueDate) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم الطرف، المبلغ، وتاريخ الاستحقاق.');
      return;
    }

    try {
      const numAmount = parseFloat(amountDue) || 0;
      
      await db.run(
        `INSERT INTO contacts_ledger (name, contact_type, type, amount_due, amount, due_date, date, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [name, activeTab, activeTab, numAmount, numAmount, dueDate, dueDate, 'pending']
      );

      setName('');
      setAmountDue('');
      await fetchContacts();
      Alert.alert('نجاح', 'تم تسجيل وحفظ الدين بنجاح.');
    } catch (error) {
      console.error('خطأ في حفظ السجل:', error);
      Alert.alert('خطأ', 'فشل حفظ السجل في قاعدة البيانات.');
    }
  };

  const handleMarkAsPaid = (item) => {
    Alert.alert(
      'تأكيد السداد',
      `هل تم سداد مبلغ ${(item.amount_due || item.amount || 0).toLocaleString()} ر.ي الخاص بـ ${item.name} بالكامل؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'نعم، تم السداد', 
          onPress: async () => {
            try {
              await db.run(
                `UPDATE contacts_ledger SET status = 'paid' WHERE id = ?;`,
                [item.id]
              );
              await fetchContacts(); 
              Alert.alert('تم', 'تم تسجيل السداد وإخفاء السجل بنجاح.');
            } catch (error) {
              console.error('خطأ في تسجيل السداد:', error);
              Alert.alert('خطأ', 'فشل تسجيل السداد.');
            }
          },
        },
      ]
    );
  };

  const isOverdue = (targetDateStr) => {
    if (!targetDateStr) return false;
    const today = new Date().toISOString().slice(0, 10);
    return targetDateStr < today;
  };

  const renderContactItem = ({ item }) => {
    const itemDate = item.due_date || item.date;
    const itemAmount = item.amount_due !== undefined && item.amount_due !== null ? item.amount_due : item.amount;
    const overdue = isOverdue(itemDate);

    return (
      <View style={[
        styles.card, 
        overdue ? styles.borderRed : (activeTab === 'customer' ? styles.borderBlue : styles.borderPurple),
        overdue && styles.overdueCardBg
      ]}>
        <View style={styles.cardHeader}>
          <Text style={styles.contactName}>{item.name}</Text>
          <View style={styles.dateBadgeContainer}>
            {overdue && <Text style={styles.warningIcon}>⚠️ </Text>}
            <Text style={[styles.dueDateText, overdue && styles.textRedBold]}>
              {overdue ? `متأخر (استحقاق: ${itemDate})` : `استحقاق: ${itemDate}`}
            </Text>
          </View>
        </View>
        
        <View style={styles.cardDetails}>
          <Text style={styles.detailText}>
            {activeTab === 'customer' ? 'المبلغ المطلوب منه:' : 'المبلغ المستحق له:'}
          </Text>
          <Text style={[styles.amountText, overdue && styles.textRedBold]}>
            {(itemAmount || 0).toLocaleString()} ر.ي
          </Text>
        </View>

        {overdue && (
          <View style={styles.overdueBanner}>
            <Text style={styles.overdueBannerText}>تنبيه: تجاوز تاريخ الاستحقاق المحدد</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.paidButton} 
          onPress={() => handleMarkAsPaid(item)}
          activeOpacity={0.8}
        >
          <Text style={styles.paidButtonText}>✓ تم السداد</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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

      {/* ملخص الإجمالي العام غير المسدد */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryLabel}>
          إجمالي {activeTab === 'customer' ? 'ديون العملاء غير المسددة' : 'مستحقات الموردين غير المسددة'}:
        </Text>
        <Text style={[styles.summaryValue, activeTab === 'customer' ? styles.textBlue : styles.textPurple]}>
          {totalAmount.toLocaleString()} ر.ي
        </Text>
      </View>

      {/* قسم الإدخال */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>
          {activeTab === 'customer' ? 'إضافة دين جديد على عميل' : 'إضافة مستحق جديد لمورد'}
        </Text>

        <TextInput
          style={[styles.input, { marginBottom: 10 }]}
          placeholder={activeTab === 'customer' ? 'اسم العميل' : 'اسم المورد'}
          value={name}
          onChangeText={setName}
        />

        <View style={styles.inputRow}>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.fieldLabel}>تاريخ الاستحقاق:</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={dueDate}
              onChangeText={setDueDate}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>المبلغ (ريال):</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0"
              value={amountDue}
              onChangeText={setAmountDue}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, activeTab === 'customer' ? styles.bgBlue : styles.bgPurple]} 
          onPress={handleSaveContact}
        >
          <Text style={styles.saveButtonText}>حفظ وتوثيق السجل</Text>
        </TouchableOpacity>
      </View>

      {/* قائمة العرض */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>
          {activeTab === 'customer' ? 'قائمة ديون العملاء المعلقة' : 'قائمة مستحقات الموردين المعلقة'}
        </Text>
        <FlatList
          data={contactsList}
          keyExtractor={item => item.id.toString()}
          renderItem={renderContactItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyText}>لا توجد ديون معلقة، كل الحسابات مسددة ✅</Text>}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  tabContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 4,
    backgroundColor: '#F1F5F9',
  },
  activeTabBlue: { backgroundColor: '#2563EB' },
  activeTabPurple: { backgroundColor: '#7C3AED' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#FFFFFF' },

  summaryBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  summaryValue: { fontSize: 15, fontWeight: 'bold' },

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
  fieldLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  saveButton: {
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  bgBlue: { backgroundColor: '#2563EB' },
  bgPurple: { backgroundColor: '#7C3AED' },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },

  listSection: { flex: 1, paddingHorizontal: 15 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderRightWidth: 4,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  borderBlue: { borderRightColor: '#2563EB' },
  borderPurple: { borderRightColor: '#7C3AED' },
  borderRed: { borderRightColor: '#EF4444' },
  overdueCardBg: { backgroundColor: '#FEF2F2' },

  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactName: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  dateBadgeContainer: { flexDirection: 'row-reverse', alignItems: 'center' },
  warningIcon: { fontSize: 12 },
  dueDateText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  textRedBold: { color: '#DC2626', fontWeight: 'bold' },

  cardDetails: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  detailText: { fontSize: 13, color: '#64748B' },
  amountText: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },

  overdueBanner: {
    marginTop: 8,
    backgroundColor: '#FEE2E2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  overdueBannerText: { fontSize: 11, color: '#DC2626', fontWeight: 'bold' },

  paidButton: {
    marginTop: 10,
    backgroundColor: '#10B981',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  paidButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },

  textBlue: { color: '#2563EB' },
  textPurple: { color: '#7C3AED' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 15, fontSize: 13 },
});
