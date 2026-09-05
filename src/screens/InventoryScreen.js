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
  Platform,
  SafeAreaView,
  StatusBar
} from 'react-native';
import db from '../db';

// دالة مساعدة للحصول على تاريخ اليوم بشكل آمن (بدون مشاكل Timezone التي يسببها toISOString)
const getLocalTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// دالة مساعدة للحصول على الشهر الحالي
const getCurrentMonthString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export default function InventoryScreen() {
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [minAlert, setMinAlert] = useState('');
  const [entryDate, setEntryDate] = useState(getLocalTodayString()); 
  
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthString());
  const [inventoryList, setInventoryList] = useState([]);
  const [expiredCount, setExpiredCount] = useState(0);

  useEffect(() => {
    initTableAndFetch();
  }, [selectedMonth]);

  const changeMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let newMonth = month + delta;
    let newYear = year;

    // التعامل الآمن مع الانتقال بين السنوات
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    // منع الانتقال إلى شهر يتجاوز الشهر الحالي
    const d = new Date();
    const currentYear = d.getFullYear();
    const currentMonth = d.getMonth() + 1;
    
    if (newYear > currentYear || (newYear === currentYear && newMonth > currentMonth)) {
      return;
    }

    const formattedMonth = String(newMonth).padStart(2, '0');
    setSelectedMonth(`${newYear}-${formattedMonth}`);
  };

  const initTableAndFetch = async () => {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS inventory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          product_name TEXT,
          quantity REAL DEFAULT 0,
          qty REAL DEFAULT 0,
          expiry_date TEXT,
          expiry TEXT,
          min_alert_quantity REAL DEFAULT 0,
          minAlert REAL DEFAULT 0,
          entry_date TEXT
        );
      `);

      await fetchInventory();
    } catch (error) {
      console.error('خطأ في تهيئة جدول المخزون:', error);
    }
  };

  const fetchInventory = async () => {
    try {
      const results = await db.query(
        `SELECT * FROM inventory 
         WHERE entry_date LIKE ? 
         ORDER BY id DESC;`,
        [`${selectedMonth}%`]
      );
      
      const data = results || [];
      setInventoryList(data);

      const expiredItems = data.filter(item => {
        const exp = item.expiry_date || item.expiry;
        return exp ? new Date(exp) < new Date() : false;
      }).length;

      setExpiredCount(expiredItems);
    } catch (error) {
      console.error('خطأ في جلب بيانات المخزون:', error);
    }
  };

  const handleSaveProduct = async () => {
    if (!productName || !quantity || !expiryDate || !entryDate) {
      Alert.alert('تنبيه', 'يرجى تعبئة جميع الحقول الأساسية.');
      return;
    }

    try {
      const numQty = parseFloat(quantity) || 0;
      const numMinAlert = parseFloat(minAlert) || 0;

      await db.query(
        `INSERT INTO inventory (name, product_name, quantity, qty, expiry_date, expiry, min_alert_quantity, minAlert, entry_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [productName, productName, numQty, numQty, expiryDate, expiryDate, numMinAlert, numMinAlert, entryDate]
      );

      setProductName('');
      setQuantity('');
      setExpiryDate('');
      setMinAlert('');
      
      await fetchInventory();
      Alert.alert('نجاح', 'تم إضافة المنتج للمخزون بنجاح.');
    } catch (error) {
      console.error('خطأ في حفظ المنتج:', error);
      Alert.alert('خطأ', 'فشل حفظ المنتج في قاعدة البيانات.');
    }
  };

  const renderProductItem = ({ item }) => {
    const q = item.quantity !== undefined ? item.quantity : item.qty;
    const m = item.min_alert_quantity !== undefined ? item.min_alert_quantity : item.minAlert;
    const exp = item.expiry_date || item.expiry;
    const name = item.name || item.product_name;

    const isLowStock = q <= m;
    const isExpired = exp ? new Date(exp) < new Date() : false;
    
    return (
      <View style={[styles.card, isLowStock ? styles.borderWarning : styles.borderNormal, isExpired && styles.borderDanger]}>
        <View style={styles.cardHeader}>
          <Text style={styles.productName}>{name}</Text>
          <View style={styles.badgeContainer}>
            {isLowStock && <Text style={styles.warningBadge}>نقص بالمخزون</Text>}
            {isExpired && <Text style={styles.dangerBadge}>منتهي الصلاحية</Text>}
          </View>
        </View>
        
        <View style={styles.cardDetails}>
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>الكمية الحالية</Text>
            <Text style={[styles.detailValue, isLowStock && styles.textWarning]}>
              {(q || 0).toLocaleString()}
            </Text>
          </View>
          
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>حد التنبيه</Text>
            <Text style={styles.detailValueAlert}>{(m || 0).toLocaleString()}</Text>
          </View>
          
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>تاريخ الصلاحية</Text>
            <Text style={[styles.detailValueExpiry, isExpired && styles.textDanger]}>{exp}</Text>
          </View>
        </View>

        <Text style={styles.entryDateText}>تاريخ الإدخال: {item.entry_date}</Text>
      </View>
    );
  };

  // تهيئة متغيرات العرض والتنقل
  const [selYear, selMonth] = selectedMonth.split('-').map(Number);
  const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const displayMonthName = `${arabicMonths[selMonth - 1]} ${selYear}`;
  
  const currentD = new Date();
  const isNextDisabled = selYear > currentD.getFullYear() || (selYear === currentD.getFullYear() && selMonth >= (currentD.getMonth() + 1));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.monthSelectorBar}>
          {/* الزر الأيمن: الشهر التالي (بسبب row-reverse يظهر على اليمين) */}
          <TouchableOpacity 
            style={[styles.monthNavBtn, isNextDisabled && styles.monthNavBtnDisabled]} 
            onPress={() => changeMonth(1)}
            disabled={isNextDisabled}
          >
            <Text style={[styles.monthNavText, isNextDisabled && styles.monthNavTextDisabled]}>›</Text>
          </TouchableOpacity>

          <View style={styles.monthDisplayContainer}>
            <Text style={styles.monthLabelText}>المخزون:</Text>
            <Text style={styles.monthValueText}>{displayMonthName}</Text>
          </View>

          {/* الزر الأيسر: الشهر السابق */}
          <TouchableOpacity 
            style={styles.monthNavBtn} 
            onPress={() => changeMonth(-1)}
          >
            <Text style={styles.monthNavText}>‹</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryBar}>
          <Text style={styles.summaryLabel}>المنتجات منتهية الصلاحية:</Text>
          <Text style={[styles.summaryValue, expiredCount > 0 ? styles.textDanger : styles.textSuccess]}>
            {expiredCount} منتجات
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>تسجيل بضاعة جديدة</Text>
          
          <View style={styles.inputRow}>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.fieldLabel}>اسم المنتج:</Text>
              <TextInput
                style={styles.input}
                placeholder="أدخل اسم المنتج"
                value={productName}
                onChangeText={setProductName}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>تاريخ الإدخال:</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={entryDate}
                onChangeText={setEntryDate}
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.fieldLabel}>الكمية المتوفرة:</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="0"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>تاريخ الصلاحية:</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={expiryDate}
                onChangeText={setExpiryDate}
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>الحد الأدنى للتنبيه:</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="مثال: 5"
                value={minAlert}
                onChangeText={setMinAlert}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSaveProduct} activeOpacity={0.8}>
            <Text style={styles.saveButtonText}>حفظ في المخزون</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>قائمة المخزون ({displayMonthName})</Text>
          <FlatList
            data={inventoryList}
            keyExtractor={item => item.id.toString()}
            renderItem={renderProductItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={<Text style={styles.emptyText}>لا توجد بضائع مسجلة في هذا الشهر.</Text>}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  monthSelectorBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthNavBtn: {
    backgroundColor: '#F1F5F9',
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavBtnDisabled: {
    backgroundColor: '#FAFAFA',
    opacity: 0.5,
  },
  monthNavText: { 
    fontSize: 22, 
    color: '#334155', 
    fontWeight: 'bold',
    lineHeight: 28,
  },
  monthNavTextDisabled: {
    color: '#CBD5E1',
  },
  monthDisplayContainer: { alignItems: 'center' },
  monthLabelText: { fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  monthValueText: { fontSize: 16, color: '#0F172A', fontWeight: 'bold' },

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
  summaryValue: { fontSize: 14, fontWeight: 'bold' },
  textSuccess: { color: '#10B981' },
  textWarning: { color: '#F59E0B' },
  textDanger: { color: '#EF4444' },

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
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
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
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0F172A',
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  saveButton: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },

  listSection: { flex: 1, paddingHorizontal: 15 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderRightWidth: 4,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  borderNormal: { borderRightColor: '#3B82F6' },
  borderWarning: { borderRightColor: '#F59E0B' },
  borderDanger: { borderRightColor: '#EF4444' },
  
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  productName: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  badgeContainer: { flexDirection: 'row-reverse', gap: 5 },
  warningBadge: { backgroundColor: '#FEF3C7', color: '#D97706', fontSize: 10, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, fontWeight: 'bold' },
  dangerBadge: { backgroundColor: '#FEE2E2', color: '#DC2626', fontSize: 10, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, fontWeight: 'bold' },
  
  cardDetails: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginBottom: 8,
  },
  detailCol: { alignItems: 'center' },
  detailLabel: { fontSize: 11, color: '#64748B', marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },
  detailValueAlert: { fontSize: 14, fontWeight: 'bold', color: '#F59E0B' },
  detailValueExpiry: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  
  entryDateText: { fontSize: 10, color: '#94A3B8', textAlign: 'right', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 20, fontSize: 13 },
});
