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
// 💎 المكون التفاعلي: الأيقونة الزجاجية 3D التفاعلية
// ==========================================
const Glass3DIcon = ({ icon, gradientColor, borderColor, shadowColor, size = 64, iconScale = 0.5 }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1500,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1, 
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={[styles.glassWrapper, { width: size + 15, height: size + 15 }]}>
      <Animated.View 
        style={[
          styles.glassOuterRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: borderColor,
            shadowColor: shadowColor,
            shadowOpacity: 0.8, 
            shadowRadius: 15,
            elevation: 12,
            transform: [
              { translateY: floatAnim },
              { scale: pulseAnim }
            ]
          }
        ]}
      >
        <View style={[styles.glassInnerCore, { backgroundColor: gradientColor, borderRadius: size / 2 }]}>
          <View style={styles.glassHighlight} />
          <View style={styles.glassBottomReflection} />
          
          <Text style={[
            styles.glassIconText, 
            { 
              fontSize: size * iconScale, 
              textShadowColor: shadowColor, 
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 12 
            }
          ]}>
            {icon}
          </Text>
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
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const loadAppData = async () => {
      await initDatabase();
      await fetchDashboardStats();
    };
    loadAppData();
  }, [currentScreen]);

  const initDatabase = async () => {
    try {
      await initDB();
      // متوافق مع جداول db.js المحدثة (daily_transactions, treasury, contacts_ledger, inventory)
      const treasuryCheck = await db.getAll('SELECT * FROM treasury LIMIT 1;');
      if (!treasuryCheck || treasuryCheck.length === 0) {
        await db.run('INSERT INTO treasury (account_type, transaction_type, amount, date) VALUES (?, ?, ?, ?);', ['الصندوق', 'income', 0, new Date().toISOString().split('T')[0]]);
      }
    } catch (error) {
      console.error('خطأ في تهيئة قاعدة البيانات:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      // 1. حساب أرصدة الخزينة من جدول treasury
      const treasuryRes = await db.getAll('SELECT account_type, SUM(CASE WHEN transaction_type IN ("income", "قبض") THEN amount ELSE -amount END) as balance FROM treasury GROUP BY account_type;');
      let cash = 0;
      let bank = 0;
      if (treasuryRes && treasuryRes.length > 0) {
        treasuryRes.forEach(item => {
          if (item.account_type === 'الصندوق' || item.account_type === 'cash') cash += item.balance || 0;
          if (item.account_type === 'البنك' || item.account_type === 'bank') bank += item.balance || 0;
        });
      }

      // 2. حساب صافي اليوم الفعلي من جدول daily_transactions (حركة اليوم)
      const today = new Date().toISOString().split('T')[0];
      const logsRes = await db.getAll(`SELECT SUM(net_profit) as totalNet FROM daily_transactions WHERE date = '${today}';`);
      const calculatedDailyNet = logsRes && logsRes[0] ? logsRes[0].totalNet || 0 : 0;

      setStats({
        dailyNet: calculatedDailyNet,
        cashBalance: cash,
        bankBalance: bank,
      });

      // 3. جلب التنبيهات الحقيقية من جدول contacts_ledger و inventory
      const newAlerts = [];
      const debtsRes = await db.getAll(`SELECT COUNT(*) as count FROM contacts_ledger WHERE amount_due > 0 AND due_date <= '${today}';`);
      if (debtsRes[0]?.count > 0) {
        newAlerts.push({ id: 1, type: 'danger', message: `يوجد ${debtsRes[0].count} جهات تعامل لديهم ديون مستحقة!`, date: 'عاجل' });
      }

      const invRes = await db.getAll(`SELECT COUNT(*) as count FROM inventory WHERE quantity <= min_alert_quantity;`);
      if (invRes[0]?.count > 0) {
        newAlerts.push({ id: 2, type: 'warning', message: `يوجد ${invRes[0].count} أصناف في المخزون قاربت على النفاد`, date: 'تنبيه' });
      }

      setAlerts(newAlerts);

    } catch (error) {
      console.error('خطأ في جلب بيانات اللوحة:', error);
    }
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'daily': return <DailyLogScreen />;
      case 'inventory': return <InventoryScreen />;
      case 'treasury': return <TreasuryScreen />;
      case 'contacts': return <ContactsScreen />;
      case 'reports': return <ReportsScreen />;
      default: return renderDashboard();
    }
  };

  const StatCard = ({ title, amount, color, icon, bgGlow, borderColor }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Glass3DIcon 
          icon={icon} 
          gradientColor={bgGlow} 
          borderColor={borderColor} 
          shadowColor={color} 
          size={50} 
        />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={[styles.cardAmount, { color: color }]}>
        {amount.toLocaleString()} <Text style={styles.currency}>ر.ي</Text>
      </Text>
    </View>
  );

  const AlertCard = ({ type, message, date }) => {
    const isDanger = type === 'danger';
    return (
      <View style={[styles.alertCard, isDanger ? styles.alertDanger : styles.alertWarning]}>
        <Glass3DIcon 
          icon={isDanger ? '⚠️' : '🔔'} 
          gradientColor={isDanger ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)'} 
          borderColor={isDanger ? '#FCA5A5' : '#FDE68A'} 
          shadowColor={isDanger ? '#EF4444' : '#F59E0B'} 
          size={46} 
        />
        <View style={styles.alertTextContainer}>
          <Text style={styles.alertMessage}>{message}</Text>
          <Text style={styles.alertDate}>{date}</Text>
        </View>
      </View>
    );
  };

  const MenuButton = ({ title, icon, action, bgGlow, borderColor, shadowColor, isFullWidth }) => (
    <TouchableOpacity 
      style={[styles.menuButton, isFullWidth && styles.menuButtonFull]} 
      onPress={() => setCurrentScreen(action)} 
      activeOpacity={0.85}
    >
      <Glass3DIcon 
        icon={icon} 
        gradientColor={bgGlow} 
        borderColor={borderColor} 
        shadowColor={shadowColor} 
        size={isFullWidth ? 64 : 68} 
        iconScale={0.55} 
      />
      <Text style={[styles.menuButtonText, isFullWidth && styles.menuButtonTextFull]}>{title}</Text>
    </TouchableOpacity>
  );

  const renderDashboard = () => (
    <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>المركز المالي اليومي</Text>
        <View style={styles.statsRow}>
          <StatCard title="صافي اليوم" amount={stats.dailyNet} color="#10B981" icon="📈" bgGlow="rgba(16, 185, 129, 0.25)" borderColor="#6EE7B7"/>
          <StatCard title="الصندوق" amount={stats.cashBalance} color="#2563EB" icon="💵" bgGlow="rgba(37, 99, 235, 0.25)" borderColor="#93C5FD"/>
        </View>
        <View style={styles.statsRow}>
          <StatCard title="البنك" amount={stats.bankBalance} color="#4F46E5" icon="🏦" bgGlow="rgba(79, 70, 229, 0.25)" borderColor="#C7D2FE"/>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>التنبيهات العاجلة</Text>
        {alerts.length > 0 ? (
          alerts.map(alert => (
            <AlertCard key={alert.id} type={alert.type} message={alert.message} date={alert.date} />
          ))
        ) : (
          <View style={styles.emptyAlerts}>
            <Text style={styles.emptyAlertsText}>لا توجد تنبيهات حالياً، كل شيء على ما يرام ✅</Text>
          </View>
        )}
      </View>

      <View style={[styles.section, { marginBottom: 15 }]}>
        <Text style={styles.sectionTitle}>العمليات السريعة</Text>
        <View style={styles.menuGridContainer}>
          
          <View style={styles.menuRow}>
            <MenuButton title="حركة اليوم" icon="🛒" action="daily" bgGlow="rgba(59, 130, 246, 0.3)" borderColor="#93C5FD" shadowColor="#3B82F6"/>
            <MenuButton title="النقدية" icon="💰" action="treasury" bgGlow="rgba(245, 158, 11, 0.3)" borderColor="#FDE68A" shadowColor="#F59E0B"/>
          </View>

          <View style={styles.menuRow}>
            <MenuButton title="المخزون" icon="📦" action="inventory" bgGlow="rgba(16, 185, 129, 0.3)" borderColor="#A7F3D0" shadowColor="#10B981"/>
            <MenuButton title="الديون" icon="👥" action="contacts" bgGlow="rgba(99, 102, 241, 0.3)" borderColor="#C7D2FE" shadowColor="#6366F1"/>
          </View>

          <MenuButton title="التقارير" icon="📊" action="reports" bgGlow="rgba(168, 85, 247, 0.3)" borderColor="#E9D5FF" shadowColor="#A855F7" isFullWidth={true} />
          
        </View>
      </View>

      {/* تذييل المطور مع تعديل اتجاه كلمة تطوير لتصبح قبل الاسم تماماً في اليسار */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>نظام الميزان المحاسبي • الإصدار 1.0</Text>
        <View style={styles.developerRow}>
          <Text style={styles.developerTitle}>تطوير:</Text>
          <Text style={styles.developerName}>سالم فهمي التريمي</Text>
        </View>
      </View>
      
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        {currentScreen !== 'dashboard' ? (
          <TouchableOpacity onPress={() => setCurrentScreen('dashboard')} style={styles.backButton}>
            <Text style={styles.backButtonText}>{"➔ عودة للرئيسية"}</Text>
          </TouchableOpacity>
        ) : (
          <Glass3DIcon icon="⚖️" gradientColor="rgba(79, 70, 229, 0.25)" borderColor="#C7D2FE" shadowColor="#4338CA" size={44} />
        )}
        <Text style={styles.headerTitle}>نظام الميزان المحاسبي</Text>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>سبتمبر 2026</Text>
        </View>
      </View>

      {renderCurrentScreen()}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
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
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  dateBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#C7D2FE' },
  dateText: { color: '#4338CA', fontWeight: '700', fontSize: 11 },
  backButton: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  backButtonText: { color: '#2563EB', fontWeight: 'bold', fontSize: 13 },
  scrollArea: { flex: 1, paddingHorizontal: 16 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 10, textAlign: 'right' },
  statsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10, gap: 10 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, flex: 1,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontSize: 13, color: '#64748B', fontWeight: '700', textAlign: 'right' },
  cardAmount: { fontSize: 19, fontWeight: '900', textAlign: 'right' },
  currency: { fontSize: 11, fontWeight: 'normal', color: '#94A3B8' },
  
  alertCard: {
    flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 10, paddingHorizontal: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E2E8F0', borderRightWidth: 5,
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  alertDanger: { borderRightColor: '#EF4444' },
  alertWarning: { borderRightColor: '#F59E0B' },
  alertTextContainer: { flex: 1, alignItems: 'flex-end', marginRight: 10 },
  alertMessage: { fontSize: 13, fontWeight: '700', color: '#1E293B', textAlign: 'right' },
  alertDate: { fontSize: 11, color: '#64748B', marginTop: 2 },
  emptyAlerts: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  emptyAlertsText: { color: '#64748B', fontSize: 13, fontWeight: 'bold' },

  menuGridContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  menuRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 12,
  },
  menuButton: {
    backgroundColor: '#FFFFFF',
    flex: 1, 
    height: 125, 
    borderRadius: 18, 
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#475569',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    paddingVertical: 10,
  },
  menuButtonFull: {
    flex: undefined,
    width: '100%',
    height: 100, 
    flexDirection: 'row-reverse', 
    gap: 15,
  },
  menuButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#334155',
    marginTop: 8,
  },
  menuButtonTextFull: {
    fontSize: 16,
    marginTop: 0, 
  },

  glassWrapper: { alignItems: 'center', justifyContent: 'center' },
  glassOuterRing: { 
    borderWidth: 2, 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowOffset: { width: 0, height: 4 } 
  },
  glassInnerCore: { 
    width: '100%', 
    height: '100%', 
    alignItems: 'center', 
    justifyContent: 'center', 
    overflow: 'hidden', 
    position: 'relative' 
  },
  glassHighlight: { 
    position: 'absolute', 
    top: '2%', left: '5%', right: '5%', 
    height: '45%', 
    backgroundColor: 'rgba(255, 255, 255, 0.65)', 
    borderTopLeftRadius: 100, borderTopRightRadius: 100 
  },
  glassBottomReflection: { 
    position: 'absolute', 
    bottom: '2%', left: '15%', right: '15%', 
    height: '25%', 
    backgroundColor: 'rgba(255, 255, 255, 0.25)', 
    borderBottomLeftRadius: 100, borderBottomRightRadius: 100 
  },
  glassIconText: { textAlign: 'center' },

  footerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  developerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  developerTitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: 'bold',
  },
  developerName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#4338CA', 
    textShadowColor: 'rgba(67, 56, 202, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  }
});
