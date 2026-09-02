import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { useAuthStore } from '../../store/useAuthStore';
import { PatientService } from '../../lib/services/patient';
import { QR, AccessRequest } from '../../types';
import { Button } from '../../components/ui/Button';
import { ShieldCheck, History, Settings, LogOut, Activity, RefreshCw, Key } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

export default function PatientDashboard() {
  const { patient, logout } = useAuthStore();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [activeQR, setActiveQR] = useState<QR | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);

  const loadData = async () => {
    if (!patient) return;
    try {
      const qr = await PatientService.getActiveQR(patient.id);
      if (qr) setActiveQR(qr);
      
      const reqs = await PatientService.getPendingRequests(patient.id);
      setPendingRequests(reqs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    
    if (patient) {
      const unsubscribe = PatientService.subscribeToPendingRequests(patient.id, () => {
        loadData();
      });
      return () => unsubscribe();
    }
  }, [patient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };
  
  const handleRegenerateQR = () => {
    Alert.alert(
      "Regenerate QR Code",
      "Are you sure? This will immediately invalidate your previous code.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Regenerate", 
          style: "destructive",
          onPress: async () => {
            if (!patient) return;
            setLoadingQR(true);
            if (Platform.OS !== 'web') {
              import('expo-haptics').then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
            }
            try {
              const newQR = await PatientService.regenerateQR(patient.id);
              setActiveQR(newQR);
              if (Platform.OS !== 'web') {
                import('expo-haptics').then(Haptics => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
              }
            } catch (err) {
              Alert.alert("Error", "Failed to regenerate QR code.");
            } finally {
              setLoadingQR(false);
            }
          }
        }
      ]
    );
  };

  if (!patient) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Identity active</Text>
            <Text style={styles.name}>{patient.name}</Text>
          </View>
          <LogOut color={Colors.textSecondary} size={24} onPress={() => { logout(); router.replace('/'); }} />
        </View>

        {pendingRequests.map(req => (
          <Animated.View key={req.id} entering={FadeInDown.springify()} exiting={FadeOutUp} style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <Key color={Colors.primary} size={20} />
              <Text style={styles.otpTitle}>Doctor Requesting Access</Text>
            </View>
            <Text style={styles.otpSubtitle}>Give this code to the doctor to securely authorize access to your medical file.</Text>
            <View style={styles.otpCodeContainer}>
              <Text style={styles.otpCode}>{req.otp_hash}</Text>
            </View>
          </Animated.View>
        ))}

        <View style={styles.qrSection}>
          <View style={styles.qrContainer}>
            {activeQR ? (
              <QRCode
                value={activeQR.code_value}
                size={220}
                color={Colors.text}
                backgroundColor={Colors.white}
                quietZone={16}
              />
            ) : (
              <View style={[styles.qrPlaceholder, { width: 220, height: 220 }]} />
            )}
          </View>
          <View style={styles.securityBadge}>
            <ShieldCheck color={Colors.success} size={16} />
            <Text style={styles.securityText}>Consent-Gated Protection</Text>
          </View>
          <Text style={styles.qrHelperText}>Last updated: {new Date(patient.last_updated).toLocaleDateString()}</Text>
          
          <Button 
            title="Regenerate QR"
            variant="ghost"
            icon={<RefreshCw size={16} color={Colors.textSecondary} />}
            onPress={handleRegenerateQR}
            isLoading={loadingQR}
            textStyle={{ color: Colors.textSecondary }}
            style={{ marginTop: Spacing.md }}
          />
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionHeader}>MEDICAL IDENTITY SUMMARY</Text>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Blood Group</Text>
              <Text style={styles.summaryValuePrimary}>{patient.blood_group}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Allergies</Text>
              <View style={styles.summaryValueRow}>
                <Text style={styles.summaryValue}>{patient.allergies.length}</Text>
                {patient.allergies.some(a => a.severity === 'severe') && (
                  <Activity color={Colors.error} size={16} style={{ marginLeft: 4 }} />
                )}
              </View>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Conditions</Text>
              <Text style={styles.summaryValue}>{patient.conditions.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <Text style={styles.sectionHeader}>ACTIONS</Text>
          
          <Button
            title="Edit Medical Data"
            onPress={() => router.push('/(patient)/edit-data')}
            variant="secondary"
            icon={<Settings color={Colors.text} size={20} />}
            style={styles.actionButton}
          />
          <Button
            title="Access History"
            onPress={() => router.push('/(patient)/history')}
            variant="secondary"
            icon={<History color={Colors.text} size={20} />}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: Spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'android' ? Spacing.xl : Spacing.md,
    paddingBottom: Spacing.xl,
  },
  greeting: {
    ...Typography.smallMedium,
    color: Colors.success,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    ...Typography.h1,
    color: Colors.text,
  },
  qrSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: Colors.surface,
  },
  qrContainer: {
    backgroundColor: Colors.white,
    padding: Spacing.xs,
    borderRadius: BorderRadius.xl,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  qrPlaceholder: {
    backgroundColor: Colors.surfaceHover,
    borderRadius: BorderRadius.lg,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successSurface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xl,
  },
  securityText: {
    ...Typography.smallMedium,
    color: Colors.success,
    marginLeft: Spacing.xs,
  },
  qrHelperText: {
    ...Typography.metadata,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  summarySection: {
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  sectionHeader: {
    ...Typography.sectionHeader,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  summaryValuePrimary: {
    ...Typography.h2,
    color: Colors.error, // Blood group stands out
  },
  summaryValue: {
    ...Typography.h2,
    color: Colors.text,
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsSection: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
  actionButton: {
    marginBottom: Spacing.md,
    justifyContent: 'flex-start',
  },
  otpCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  otpTitle: {
    ...Typography.h3,
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
  otpSubtitle: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  otpCodeContainer: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  otpCode: {
    ...Typography.display,
    color: Colors.primary,
    letterSpacing: 8,
  },
});
