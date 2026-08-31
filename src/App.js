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
      await initDB();

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
          dailyNet: 15000,
          cashBalance: res[0].cash_balance || 0,
          bankBalance: res[0].bank_balance || 0,
        });
      }
    } catch (error) {
      console.error('خطأ في جلب بيانات اللوحة:', error);
    }
  };

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

  // بطاقة إحصائية علوية فاخرة
  const StatCard = ({ title, amount, color, icon }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
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
        <Text style={styles.alertBadgeIcon}>{isDanger ? '⚠️' : '🔔'}</Text>
        <View style={styles.alertTextContainer}>
          <Text style={styles.alertMessage}>{message}</Text>
          <Text style={styles.alertDate}>{date}</Text>
        </View>
      </View>
    );
  };

  // زر التنقل في الشبكة الرئيسية
  const MenuButton = ({ title, icon, action, bgGlow }) => (
    <TouchableOpacity style={styles.menuButton} onPress={() => setCurrentScreen(action)} activeOpacity={0.85}>
      <View style={[styles.menuIconPlaceholder, { backgroundColor: bgGlow }]}>
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
          <StatCard title="صافي اليوم" amount={stats.dailyNet} color="#10B981" icon="📈" />
          <StatCard title="الصندوق" amount={stats.cashBalance} color="#2563EB" icon="💵" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title="البنك" amount={stats.bankBalance} color="#4F46E5" icon="🏦" />
        </View>
      </View>

      {/* مركز التنبيهات الذكي */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>التنبيهات العاجلة</Text>
        <AlertCard type="danger" message="استحقاق ديون عملاء مستحقة اليوم" date="اليوم" />
        <AlertCard type="warning" message="مراجعة أرصدة الخزينة والمخزون الدوري" date="دوري" />
      </View>

      {/* أزرار العمليات والوصول السريع */}
      <View style={[styles.section, { marginBottom: 35 }]}>
        <Text style={styles.sectionTitle}>العمليات السريعة</Text>
        <View style={styles.menuGrid}>
          <MenuButton title="حركة اليوم" icon="🛒" action="daily" bgGlow="#EFF6FF" />
          <MenuButton title="المخزون" icon="📦" action="inventory" bgGlow="#F0FDF4" />
          <MenuButton title="النقدية" icon="💰" action="treasury" bgGlow="#FEF3C7" />
          <MenuButton title="الديون" icon="👥" action="contacts" bgGlow="#EEF2FF" />
          <MenuButton title="التقارير" icon="📊" action="reports" bgGlow="#F3E8FF" />
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* الشريط العلوي الفاخر */}
      <View style={styles.header}>
        {currentScreen !== 'dashboard' ? (
          <TouchableOpacity onPress={() => setCurrentScreen('dashboard')} style={styles.backButton}>
            <Text style={styles.backButtonText}>{"➔ عودة للرئيسية"}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>⚖️</Text>
          </View>
        )}
        <Text style={styles.headerTitle}>نظام الميزان المحاسبي</Text>
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
    backgroundColor: '#F1F5F9', // خلفية رمادية فائقة النعومة لإبراز البطاقات البيضاء
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  logoBadge: {
    backgroundColor: '#F8FAFC',
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoIcon: {
    fontSize: 18,
  },
  dateBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  dateText: {
    color: '#4338CA',
    fontWeight: '700',
    fontSize: 11,
  },
  backButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#2563EB',
    fontWeight: 'bold',
    fontSize: 13,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 10,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardIcon: {
    fontSize: 16,
  },
  cardTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'right',
  },
  cardAmount: {
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'right',
  },
  currency: {
    fontSize: 11,
    fontWeight: 'normal',
    color: '#94A3B8',
  },
  alertCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRightWidth: 5,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  alertDanger: { borderRightColor: '#EF4444' },
  alertWarning: { borderRightColor: '#F59E0B' },
  alertBadgeIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  alertTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  alertMessage: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
  },
  alertDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  menuGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  menuButton: {
    backgroundColor: '#FFFFFF',
    width: '31%',
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  menuIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  menuIconText: {
    fontSize: 22,
  },
  menuButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
});
