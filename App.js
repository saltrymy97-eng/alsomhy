import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar 
} from 'react-native';

// استيراد وسيط قاعدة البيانات المحلي للديسكتوب
import db, { initDB } from './db';

// الاستيراد الفعلي للشاشات المطلوبة من مجلد screens
import DailyLogScreen from './screens/DailyLogScreen';
import InventoryScreen from './screens/InventoryScreen';
import TreasuryScreen from './screens/TreasuryScreen';
import ContactsScreen from './screens/ContactsScreen';
import ReportsScreen from './screens/ReportsScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [stats, setStats] = useState({
    dailyNet: 0,
    cashBalance: 0,
    bankBalance: 0,
  });

  useEffect(() => {
    const loadAppData = async () => {
      await initDatabase();
      await fetchDashboardStats();
    };
    loadAppData();
  }, [currentScreen]);

  // تهيئة جداول النظام الأساسية للتأكد من جاهزية التطبيق
  const initDatabase = async () => {
    try {
      // تهيئة الجداول الرئيسية من db.js
      await initDB();

      // إنشاء جدول أرصدة الخزينة إن لم يكن موجوداً
      await db.exec(`
        CREATE TABLE IF NOT EXISTS treasury_balances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cash_balance REAL DEFAULT 0,
          bank_balance REAL DEFAULT 0
        );
      `);
      
      const res = await db.getAll('SELECT * FROM treasury_balances;');
      if (!res || res.length === 0) {
        await db.run('INSERT INTO treasury_balances (cash_balance, bank_balance) VALUES (0, 0);');
      }
    } catch (error) {
      console.error('خطأ في تهيئة قاعدة البيانات الرئيسية:', error);
    }
  };

  // جلب الأرصدة لعرضها في لوحة التحكم
  const fetchDashboardStats = async () => {
    try {
      const res = await db.getAll('SELECT * FROM treasury_balances LIMIT 1;');
      if (res && res.length > 0) {
        setStats({
          dailyNet: 15000, // يمكن ربطها بقائمة الدخل لاحقاً
          cashBalance: res[0].cash_balance || 0,
          bankBalance: res[0].bank_balance || 0,
        });
      }
    } catch (error) {
      console.error('خطأ في جلب بيانات اللوحة:', error);
    }
  };

  // تبديل الشاشات برمجياً بناءً على اختيار المستخدم
  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'daily':
        return <DailyLogScreen />;
      case 'inventory':
        return <InventoryScreen />;
      case 'treasury':
        return <TreasuryScreen />;
      case 'contacts':
        return <ContactsScreen />;
      case 'reports':
        return <ReportsScreen />;
      default:
        return renderDashboard();
    }
  };

  // بطاقة إحصائية علوية
  const StatCard = ({ title, amount, color }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[styles.cardAmount, { color: color }]}>
        {amount.toLocaleString()} <Text style={styles.currency}>ر.ي</Text>
      </Text>
    </View>
  );

  // بطاقة التنبيهات الذكية
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

  // زر التنقل في الشبكة الرئيسية
  const MenuButton = ({ title, icon, action }) => (
    <TouchableOpacity style={styles.menuButton} onPress={() => setCurrentScreen(action)} activeOpacity={0.8}>
      <View style={styles.menuIconPlaceholder}>
        <Text style={styles.menuIconText}>{icon}</Text>
      </View>
      <Text style={styles.menuButtonText}>{title}</Text>
    </TouchableOpacity>
  );

  // واجهة لوحة التحكم الرئيسية (Dashboard)
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
        <AlertCard type="danger" message="استحقاق ديون عملاء مستحقة اليوم" date="اليوم" />
        <AlertCard type="warning" message="مراجعة أرصدة الخزينة والمخزون" date="دوري" />
      </View>

      {/* أزرار العمليات والوصول السريع */}
      <View style={[styles.section, { marginBottom: 30 }]}>
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
        {currentScreen !== 'dashboard' ? (
          <TouchableOpacity onPress={() => setCurrentScreen('dashboard')} style={styles.backButton}>
            <Text style={styles.backButtonText}>{"< عودة للرئيسية"}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={styles.headerTitle}>نظام الإدارة الشامل</Text>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>أغسطس 2026</Text>
        </View>
      </View>

      {/* عرض الشاشة النشطة */}
      {renderCurrentScreen()}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  dateBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dateText: {
    color: '#4F46E5',
    fontWeight: '600',
    fontSize: 11,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    color: '#3B82F6',
    fontWeight: 'bold',
    fontSize: 14,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flex: 1,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
    textAlign: 'right',
    fontWeight: '600',
  },
  cardAmount: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
  },
  currency: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#94A3B8',
  },
  alertCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRightWidth: 4,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  alertDanger: { borderRightColor: '#EF4444' },
  alertWarning: { borderRightColor: '#F59E0B' },
  alertTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 12,
  },
  alertMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
  },
  alertDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  alertIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bgRed: { backgroundColor: '#EF4444' },
  bgOrange: { backgroundColor: '#F59E0B' },
  menuGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  menuButton: {
    backgroundColor: '#FFFFFF',
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuIconPlaceholder: {
    width: 42,
    height: 42,
    backgroundColor: '#F8FAFC',
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  menuIconText: {
    fontSize: 20,
  },
  menuButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
});
