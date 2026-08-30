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

export default function ContactsScreen() {
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' للعملاء أو 'supplier' للموردين
  const [name, setName] = useState('');
  const [amountDue, setAmountDue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [contactsList, setContactsList] = useState([]);

  useEffect(() => {
    fetchContacts();
  }, [activeTab]);

  const fetchContacts = () => {
    // محاكاة مؤقتة لجلب البيانات حسب النوع (عميل أو مورد) من SQLite
    const sampleData = activeTab === 'customer' ? [
      { id: '1', name: 'محمد صالح (دين عُملة)', amount: 15000, date: '2026-09-05', type: 'customer' },
    ] : [
      { id: '2', name: 'شركة الأغذية الكبرى (مستحق)', amount: 85000, date: '2026-09-02', type: 'supplier' },
    ];
    setContactsList(sampleData);
  };

  const handleSaveContact = () => {
    if (!name || !amountDue || !dueDate) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم الطرف، المبلغ، وتاريخ الاستحقاق.');
      return;
    }

    const newContact = {
      id: Math.random().toString(),
      name: name,
      amount: parseFloat(amountDue),
      date: dueDate,
      type: activeTab,
    };

    // سيتم حفظه في جدول contacts_ledger عبر SQLite لاحقاً
    setContactsList([newContact, ...contactsList]);

    setName('');
    setAmountDue('');
    setDueDate('');
  };

  const renderContactItem = ({ item }) => (
    <View style={[styles.card, activeTab === 'customer' ? styles.borderBlue : styles.borderPurple]}>
      <View style={styles.cardHeader}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.dueDateText}>استحقاق: {item.date}</Text>
      </View>
      
      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>
          {activeTab === 'customer' ? 'المبلغ المطلوب منه:' : 'المبلغ المستحق له:'}
        </Text>
        <Text style={styles.amountText}>{item.amount.toLocaleString()} ريال</Text>
      </View>
    </View>
  );

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

      {/* قسم الإدخال */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>
          {activeTab === 'customer' ? 'إضافة دين على عميل' : 'إضافة مستحق لمورد'}
        </Text>

        <TextInput
          style={[styles.input, { marginBottom: 10 }]}
          placeholder={activeTab === 'customer' ? 'اسم العميل' : 'اسم المورد'}
          value={name}
          onChangeText={setName}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginLeft: 10 }]}
            placeholder="تاريخ الاستحقاق (YYYY-MM-DD)"
            value={dueDate}
            onChangeText={setDueDate}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="numeric"
            placeholder="المبلغ (ريال)"
            value={amountDue}
            onChangeText={setAmountDue}
          />
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, activeTab === 'customer' ? styles.bgBlue : styles.bgPurple]} 
          onPress={handleSaveContact}
        >
          <Text style={styles.saveButtonText}>حفظ السجل 👥</Text>
        </TouchableOpacity>
      </View>

      {/* قائمة العرض */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>
          {activeTab === 'customer' ? 'قائمة ديون العملاء' : 'قائمة مستحقات الموردين'}
        </Text>
        <FlatList
          data={contactsList}
          keyExtractor={item => item.id.toString()}
          renderItem={renderContactItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyText}>لا توجد سجلات مسجلة حالياً.</Text>}
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
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 5,
    backgroundColor: '#F1F5F9',
  },
  activeTabBlue: { backgroundColor: '#3B82F6' },
  activeTabPurple: { backgroundColor: '#6366F1' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#FFFFFF' },
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
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#0F172A',
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  saveButton: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  bgBlue: { backgroundColor: '#3B82F6' },
  bgPurple: { backgroundColor: '#6366F1' },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  listSection: { flex: 1, paddingHorizontal: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderRightWidth: 4,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  borderBlue: { borderRightColor: '#3B82F6' },
  borderPurple: { borderRightColor: '#6366F1' },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  contactName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  dueDateText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  cardDetails: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  detailText: { fontSize: 14, color: '#64748B' },
  amountText: { fontSize: 15, fontWeight: 'bold', color: '#0F172A' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 20, fontSize: 14 },
});
