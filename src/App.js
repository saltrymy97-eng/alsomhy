import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  Animated,
  Easing 
} from 'react-native';

// استيراد وسيط قاعدة البيانات المحلي للديسكتوب
import db, { initDB } from './db';

// الاستيراد الفعلي للشاشات المطلوبة من مجلد screens
import DailyLogScreen from './screens/DailyLogScreen';
import InventoryScreen from './screens/InventoryScreen';
import TreasuryScreen from './screens/TreasuryScreen';
import ContactsScreen from './screens/ContactsScreen';
import ReportsScreen from './screens/ReportsScreen';

// ==========================================
// 💎 المكون التفاعلي: الأيقونة الزجاجية 3D التفاعلية والنائمة/المتحركة
// ==========================================
const Glass3DIcon = ({ icon, gradientColor, borderColor, shadowColor, size = 64 }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // حركة الطفو للأعلى وللأسفل
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 1600,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // حركة نبض الحجم والوهج
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={[styles.glassWrapper, { width: size + 10, height: size + 10 }]}>
      <Animated.View 
        style={[
          styles.glassOuterRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: borderColor,
            shadowColor: shadowColor,
            transform: [
              { translateY: floatAnim },
              { scale: pulseAnim }
            ]
          }
        ]}
      >
        <View style={[styles.glassInnerCore, { backgroundColor: gradientColor, borderRadius: size / 2 }]}>
          <View style={styles.glassHighlight} />
          <Text style={[styles.glassIconText, { fontSize: size * 0.45 }]}>{icon}</Text>
        </View>
      </Animated.View>
    </View>
  );
};

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
  const StatCard = ({ title, amount, color, icon, bgGlow, borderColor }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Glass3DIcon 
          icon={icon} 
          gradientColor={bgGlow} 
          borderColor={borderColor} 
          shadowColor={color} 
          size={42} 
        />
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
        <Glass3DIcon 
          icon={isDanger ? '⚠️' : '🔔'} 
          gradientColor={isDanger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'} 
          borderColor={isDanger ? '#FCA5A5' : '#FDE68A'} 
          shadowColor={isDanger ? '#EF4444' : '#F59E0B'} 
          size={38} 
        />
        <View style={styles.alertTextContainer}>
          <Text style={styles.alertMessage}>{message}</Text>
          <Text style={styles.alertDate}>{date}</Text>
        </View>
      </View>
    );
  };

  // زر التنقل الفاخر في الشبكة الرئيسية
  const MenuButton = ({ title, icon, action, bgGlow, borderColor, shadowColor }) => (
    <TouchableOpacity style={styles.menuButton} onPress={() => setCurrentScreen(action)} activeOpacity={0.85}>
      <Glass3DIcon 
        icon={icon} 
        gradientColor={bgGlow} 
        borderColor={borderColor} 
        shadowColor={shadowColor} 
        size={64} 
      />
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
          <StatCard 
            title="صافي اليوم" 
            amount={stats.dailyNet} 
            color="#10B981" 
            icon="📈" 
            bgGlow="rgba(16, 185, 129, 0.15)"
            borderColor="#6EE7B7"
          />
          <StatCard 
            title="الصندوق" 
            amount={stats.cashBalance} 
            color="#2563EB" 
            icon="💵" 
            bgGlow="rgba(37, 99, 235, 0.15)"
            borderColor="#93C5FD"
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard 
            title="البنك" 
            amount={stats.bankBalance} 
            color="#4F46E5" 
            icon="🏦" 
            bgGlow="rgba(79, 70, 229, 0.15)"
            borderColor="#C7D2FE"
          />
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
          <MenuButton 
            title="حركة اليوم" 
            icon="🛒" 
            action="daily" 
            bgGlow="rgba(59, 130, 246, 0.18)" 
            borderColor="#93C5FD"
            shadowColor="#3B82F6"
          />
          <MenuButton 
            title="المخزون" 
            icon="📦" 
            action="inventory" 
            bgGlow="rgba(16, 185, 129, 0.18)" 
            borderColor="#A7F3D0"
            shadowColor="#10B981"
          />
          <MenuButton 
            title="النقدية" 
            icon="💰" 
            action="treasury" 
            bgGlow="rgba(245, 158, 11, 0.18)" 
            borderColor="#FDE68A"
            shadowColor="#F59E0B"
          />
          <MenuButton 
            title="الديون" 
            icon="👥" 
            action="contacts" 
            bgGlow="rgba(99, 102, 241, 0.18)" 
            borderColor="#C7D2FE"
            shadowColor="#6366F1"
          />
          <MenuButton 
            title="التقارير" 
            icon="📊" 
            action="reports" 
            bgGlow="rgba(168, 85, 247, 0.18)" 
            borderColor="#E9D5FF"
            shadowColor="#A855F7"
          />
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
          <Glass3DIcon 
            icon="⚖️" 
            gradientColor="rgba(79, 70, 229, 0.15)" 
            borderColor="#C7D2FE" 
            shadowColor="#4338CA" 
            size={36} 
          />
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
    backgroundColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
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
  dateBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
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
    borderRadius: 16,
    padding: 14,
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 13,
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
    borderRadius: 16,
    padding: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRightWidth: 5,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  alertDanger: { borderRightColor: '#EF4444' },
  alertWarning: { borderRightColor: '#F59E0B' },
  alertTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 10,
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
    gap: 12,
  },
  menuButton: {
    backgroundColor: '#FFFFFF',
    width: '30%',
    aspectRatio: 0.9,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#475569',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    paddingVertical: 10,
  },
  menuButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginTop: 4,
  },

  // 💎 أنماط التصميم الزجاجي والـ 3D للأيقونات
  glassWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassOuterRing: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  glassInnerCore: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
  },
  glassIconText: {
    textAlign: 'center',
  },
});
