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

export default function InventoryScreen() {
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [minAlert, setMinAlert] = useState('');
  const [inventoryList, setInventoryList] = useState([]);

  useEffect(() => {
    initTableAndFetch();
  }, []);

  const initTableAndFetch = () => {
    try {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS inventory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          qty REAL NOT NULL,
          expiry TEXT NOT NULL,
          minAlert REAL NOT NULL
        );
      `);
      fetchInventory();
    } catch (error) {
      console.error('خطأ في تهيئة جدول المخزون:', error);
    }
  };

  const fetchInventory = () => {
    try {
      const results = db.getAllSync(
        'SELECT * FROM inventory ORDER BY id DESC;'
      );
      setInventoryList(results);
    } catch (error) {
      console.error('خطأ في جلب بيانات المخزون:', error);
    }
  };

  const handleSaveProduct = () => {
    if (!productName || !quantity || !expiryDate) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم المنتج، الكمية، وتاريخ الصلاحية.');
      return;
    }

    try {
      const numQty = parseFloat(quantity) || 0;
      const numMinAlert = parseFloat(minAlert) || 0;

      db.runSync(
        'INSERT INTO inventory (name, qty, expiry, minAlert) VALUES (?, ?, ?, ?);',
        [productName, numQty, expiryDate, numMinAlert]
      );

      setProductName('');
      setQuantity('');
      setExpiryDate('');
      setMinAlert('');
      fetchInventory();
    } catch (error) {
      console.error('خطأ في حفظ المنتج:', error);
      Alert.alert('خطأ', 'فشل حفظ المنتج في قاعدة البيانات.');
    }
  };

  const renderProductItem = ({ item }) => {
    const isLowStock = item.qty <= item.minAlert;
    
    return (
      <View style={[styles.card, isLowStock ? styles.borderWarning : styles.borderNormal]}>
        <View style={styles.cardHeader}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.expiryText}>ينتهي: {item.expiry}</Text>
        </View>
        
        <View style={styles.cardDetails}>
          <Text style={styles.detailText}>الكمية الحالية: <Text style={styles.highlight}>{item.qty}</Text></Text>
          <Text style={styles.detailText}>حد التنبيه: <Text style={styles.highlightAlert}>{item.minAlert}</Text></Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* قسم إدخال منتج جديد */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>إضافة بضاعة للمراقبة</Text>
        
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginLeft: 10 }]}
            placeholder="تاريخ الصلاحية (مثال: 2026-12-01)"
            value={expiryDate}
            onChangeText={setExpiryDate}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="اسم المنتج"
            value={productName}
            onChangeText={setProductName}
          />
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginLeft: 10 }]}
            keyboardType="numeric"
            placeholder="حد تنبيه النقص"
            value={minAlert}
            onChangeText={setMinAlert}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="numeric"
            placeholder="الكمية المتوفرة"
            value={quantity}
            onChangeText={setQuantity}
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveProduct}>
          <Text style={styles.saveButtonText}>حفظ في المخزون 📦</Text>
        </TouchableOpacity>
      </View>

      {/* قسم قائمة المخزون */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>المخزون الحالي والتنبيهات</Text>
        <FlatList
          data={inventoryList}
          keyExtractor={item => item.id.toString()}
          renderItem={renderProductItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyText}>لا توجد بضائع مسجلة حالياً.</Text>}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
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
    marginBottom: 10,
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
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 5,
  },
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
  borderNormal: { borderRightColor: '#3B82F6' },
  borderWarning: { borderRightColor: '#F59E0B' },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  productName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  expiryText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  cardDetails: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  detailText: { fontSize: 14, color: '#64748B' },
  highlight: { fontWeight: 'bold', color: '#0F172A' },
  highlightAlert: { fontWeight: 'bold', color: '#F59E0B' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 20, fontSize: 14 },
});
