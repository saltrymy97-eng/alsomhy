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
const Luxury3DInventoryIcon = () => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // حركة طفو 3D انسيابية مستمرة
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
          <Text style={styles.iconEmoji}>📦</Text>
        </View>
      </Animated.View>
    </View>
  );
};

export default function InventoryScreen() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState(new Date().toISOString().slice(0, 10));
  const [minAlert, setMinAlert] = useState('');
  const [inventoryList, setInventoryList] = useState([]);

  const [summary, setSummary] = useState({
    totalItems: 0,
    totalQty: 0,
    lowStockCount: 0
  });

  useEffect(() => {
    initTableAndFetch();
  }, [selectedMonth]);

  const initTableAndFetch = async () => {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS inventory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          qty REAL NOT NULL,
          expiry TEXT NOT NULL,
          minAlert REAL NOT NULL
        );
      `);
      await fetchInventoryAndSummary();
    } catch (error) {
      console.error('خطأ في تهيئة جدول المخزون:', error);
    }
  };

  const fetchInventoryAndSummary = async () => {
    try {
      // 1. جلب بضائع المخزون حسب شهر الانتهاء المحدد
      const results = await db.query(
        `SELECT * FROM inventory 
         WHERE strftime('%Y-%m', expiry) = ? 
         ORDER BY id DESC;`,
        [selectedMonth]
      );
      setInventoryList(results || []);

      // 2. حساب إجمالي الأصناف، الكميات، والتنبيهات للشهر المختار
      const summaryRes = await db.query(
        `SELECT 
           COUNT(*) as totalItems,
           COALESCE(SUM(qty), 0) as totalQty,
           COALESCE(SUM(CASE WHEN qty <= minAlert THEN 1 ELSE 0 END), 0) as lowStockCount
         FROM inventory 
         WHERE strftime('%Y-%m', expiry) = ?;`,
        [selectedMonth]
      );

      if (summaryRes && summaryRes[0]) {
        setSummary({
          totalItems: summaryRes[0].totalItems,
          totalQty: summaryRes[0].totalQty,
          lowStockCount: summaryRes[0].lowStockCount,
        });
      }
    } catch (error) {
      console.error('خطأ في جلب بيانات المخزون:', error);
    }
  };

  const changeMonth = (delta) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const handleSaveProduct = async () => {
    if (!productName || !quantity || !expiryDate) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم المنتج، الكمية، وتاريخ الصلاحية.');
      return;
    }

    try {
      const numQty = parseFloat(quantity) || 0;
      const numMinAlert = parseFloat(minAlert) || 0;

      await db.query(
        'INSERT INTO inventory (name, qty, expiry, minAlert) VALUES (?, ?, ?, ?);',
        [productName, numQty, expiryDate, numMinAlert]
      );

      setProductName('');
      setQuantity('');
      setMinAlert('');
      await fetchInventoryAndSummary();
      Alert.alert('نجاح', 'تم إضافة المنتج إلى سجل المخزون بنجاح ⚡');
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
          <View style={[styles.expiryBadge, isLowStock && styles.bgWarningBadge]}>
            <Text style={styles.expiryText}>ينتهي: {item.expiry}</Text>
          </View>
        </View>
        
        <View style={styles.cardDetails}>
          <Text style={styles.detailText}>
            الكمية الحالية: <Text style={styles.highlight}>{(item.qty || 0).toLocaleString()}</Text>
          </Text>
          <Text style={styles.detailText}>
            حد التنبيه: <Text style={styles.highlightAlert}>{(item.minAlert || 0).toLocaleString()}</Text>
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* الهيدر الفاخر والأيقونة الـ 3D */}
      <View style={styles.headerBanner}>
        <Luxury3DInventoryIcon />
        <Text style={styles.headerTitle}>إدارة وإحكام المخزون</Text>
      </View>

      {/* شريط اختيار وتنقل شهر الانتهاء */}
      <View style={styles.monthSelectorBar}>
        <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(-1)}>
          <Text style={styles.monthNavText}>▶</Text>
        </TouchableOpacity>
        
        <View style={styles.monthDisplayContainer}>
          <Text style={styles.monthLabelText}>انتهاء صلاحيات شهر:</Text>
          <Text style={styles.monthValueText}>{selectedMonth}</Text>
        </View>

        <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeMonth(1)}>
          <Text style={styles.monthNavText}>◀</Text>
        </TouchableOpacity>
      </View>

      {/* بطاقات الملخص المالي والإحصائي للمخزون */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryBox, styles.borderTopAmber]}>
          <Text style={styles.summaryBoxLabel}>أصناف الشهر</Text>
          <Text style={[styles.summaryBoxValue, styles.textAmber]}>{summary.totalItems}</Text>
        </View>

        <View style={[styles.summaryBox, styles.borderTopBlue]}>
          <Text style={styles.summaryBoxLabel}>إجمالي الكميات</Text>
          <Text style={[styles.summaryBoxValue, styles.textBlue]}>{summary.totalQty.toLocaleString()}</Text>
        </View>

        <View style={[styles.summaryBox, styles.borderTopRed]}>
          <Text style={styles.summaryBoxLabel}>تنبيهات النقص</Text>
          <Text style={[styles.summaryBoxValue, styles.textRed]}>{summary.lowStockCount}</Text>
        </View>
      </View>

      {/* قسم إدخال منتج جديد */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>إضافة بضاعة للمراقبة</Text>
        
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginLeft: 10 }]}
            placeholder="تاريخ الصلاحية (YYYY-MM-DD)"
            placeholderTextColor="#94A3B8"
            value={expiryDate}
            onChangeText={setExpiryDate}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="اسم المنتج"
            placeholderTextColor="#94A3B8"
            value={productName}
            onChangeText={setProductName}
          />
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginLeft: 10 }]}
            keyboardType="numeric"
            placeholder="حد تنبيه النقص"
            placeholderTextColor="#94A3B8"
            value={minAlert}
            onChangeText={setMinAlert}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="numeric"
            placeholder="الكمية المتوفرة"
            placeholderTextColor="#94A3B8"
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
        <Text style={styles.sectionTitle}>بضائع تنتهي في {selectedMonth}</Text>
        <FlatList
          data={inventoryList}
          keyExtractor={item => item.id.toString()}
          renderItem={renderProductItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyText}>لا توجد بضائع تنتهي صلاحيتها في هذا الشهر.</Text>}
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
    backgroundColor: '#F59E0B',
    borderColor: '#FDE68A',
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
    backgroundColor: '#D97706',
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

  // بطاقات الملخص الإحصائي
  summaryContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 14,
    marginHorizontal: 3,
    alignItems: 'center',
    borderTopWidth: 4,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  borderTopAmber: { borderTopColor: '#F59E0B' },
  borderTopBlue: { borderTopColor: '#3B82F6' },
  borderTopRed: { borderTopColor: '#EF4444' },
  summaryBoxLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  summaryBoxValue: { fontSize: 14, fontWeight: '900' },

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
    marginBottom: 10,
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
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 5,
  },
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
  borderNormal: { borderRightColor: '#3B82F6' },
  borderWarning: { borderRightColor: '#F59E0B' },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  expiryBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bgWarningBadge: { backgroundColor: '#FEF3C7' },
  expiryText: { fontSize: 12, color: '#EF4444', fontWeight: 'bold' },
  cardDetails: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  detailText: { fontSize: 14, color: '#64748B' },
  highlight: { fontWeight: 'bold', color: '#0F172A' },
  highlightAlert: { fontWeight: 'bold', color: '#F59E0B' },
  textAmber: { color: '#D97706' },
  textBlue: { color: '#2563EB' },
  textRed: { color: '#EF4444' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 25, fontSize: 14 },
});
