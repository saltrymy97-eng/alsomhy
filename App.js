import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  Platform 
} from 'react-native';

// سيتم تفعيل هذا الاستيراد لاحقاً لربط الواجهة بقاعدة البيانات
// import { initDB } from './db';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  
  // إحصائيات وهمية للتجربة (سيتم جلبها لاحقاً من SQLite)
  const stats = {
    dailyNet: 15000,
    cashBalance: 45000,
    bankBalance: 120000,
  };

  // عند تشغيل التطبيق لأول مرة، نقوم بتهيئة قاعدة البيانات
  useEffect(() => {
    // initDB().then(() => console.log('DB Ready'));
  }, []);

  // --- مكونات الواجهة الفاخرة ---

  // 1. بطاقة الإحصائيات العلوية
  const StatCard = ({ title, amount, color }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[styles.cardAmount, { color: color }]}>
        {amount.toLocaleString()} <Text style={styles.currency}>ريال</Text>
      </Text>
    </View>
  );

  // 2. بطاقة التنبيهات
  const AlertCard = ({ type, message, date }) => {
    const isDanger = type === 'danger';
    return (
      <View style={[styles.alertCard, isDanger ? styles.alertDanger : styles.alertWarning]}>
        <View style={styles.alertTextContainer}>
          <Text style={styles.alertMessage}>{message}</Text>
          <Text style={styles.alertDate}>{date}</Text>
        </View>
        <View style={[styles.alertIndicator, isDanger ? styles.bgRed : styles.bgOrange]} />
      </View>
    );
  };

  // 3. زر التنقل الرئيسي
  const MenuButton = ({ title, icon, action }) => (
    <TouchableOpacity style={styles.menuButton} onPress={() => setCurrentScreen(action)}>
      <View style={styles.menuIconPlaceholder}>
        <Text style={styles.menuIconText}>{icon}</Text>
      </View>
      <Text style={styles.menuButtonText}>{title}</Text>
    </TouchableOpacity>
  );

  // --- الشاشة الرئيسية (لوحة التحكم) ---
  const renderDashboard = () => (
    <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
      {/* ملخص الأموال */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>المركز المالي اليومي</Text>
        <View style={styles.statsRow}>
          <StatCard title="صافي اليوم" amount={stats.dailyNet} color="#10B981" />
          <StatCard title="الصندوق" amount={stats.cashBalance} color="#3B82F6" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title="البنك" amount={stats.bankBalance} color="#6366F1" />
        </View>
      </View>

      {/* مركز التنبيهات الذكي */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>التنبيهات العاجلة</Text>
        <AlertCard type="danger" message="استحقاق دين: محمد صالح" date="اليوم" />
        <AlertCard type="warning" message="انتهاء صلاحية: زبادي ممتاز" date="بعد 3 أيام" />
        <AlertCard type="warning" message="نقص كمية: دقيق أبيض" date="الكمية: 2" />
      </View>

      {/* أزرار العمليات */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>العمليات السريعة</Text>
        <View style={styles.menuGrid}>
          <MenuButton title="حركة اليوم" icon="🛒" action="daily" />
          <MenuButton title="المخزون" icon="📦" action="inventory" />
          <MenuButton title="النقدية" icon="💰" action="treasury" />
          <MenuButton title="الديون" icon="👥" action="contacts" />
          <MenuButton title="التقارير" icon="📊" action="reports" />
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* الشريط العلوي الفاخر */}
      <View style={styles.header}>
        {currentScreen !== 'dashboard' && (
          <TouchableOpacity onPress={() => setCurrentScreen('dashboard')} style={styles.backButton}>
            <Text style={styles.backButtonText}>{"< عودة"}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>نظام الإدارة الشامل</Text>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>أغسطس 2026</Text>
        </View>
      </View>

      {/* عرض الشاشات برمجياً */}
      {currentScreen === 'dashboard' ? renderDashboard() : (
        <View style={styles.placeholderScreen}>
          <Text style={styles.placeholderText}>شاشة {currentScreen} قيد التطوير...</Text>
        </View>
      )}

    </SafeAreaView>
  );
}

// --- التنسيقات (White & Luxurious Theme) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // لون رمادي فاتح جداً يبرز البطاقات البيضاء
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  dateBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateText: {
    color: '#4F46E5',
    fontWeight: '600',
    fontSize: 12,
  },
  backButton: {
    marginRight: 10,
  },
  backButtonText: {
    color: '#3B82F6',
    fontWeight: 'bold',
    fontSize: 16,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 15,
    textAlign: 'right', // متوافق مع اللغة العربية
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flex: 1,
    marginHorizontal: 5,
    // ظل فاخر
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'right',
  },
  cardAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  currency: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#94A3B8',
  },
  alertCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderRightWidth: 4,
  },
  alertDanger: { borderRightColor: '#EF4444' },
  alertWarning: { borderRightColor: '#F59E0B' },
  alertTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 15,
  },
  alertMessage: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  alertDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  alertIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  bgRed: { backgroundColor: '#EF4444' },
  bgOrange: { backgroundColor: '#F59E0B' },
  menuGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuButton: {
    backgroundColor: '#FFFFFF',
    width: '31%', // يتيح 3 أزرار في الصف
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  menuIconPlaceholder: {
    width: 45,
    height: 45,
    backgroundColor: '#F8FAFC',
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  menuIconText: {
    fontSize: 20,
  },
  menuButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  placeholderScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#94A3B8',
  }
});
