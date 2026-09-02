import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, Platform, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { useAuthStore } from '../../store/useAuthStore';
import { Button } from '../../components/ui/Button';
import { ScanFace, LogOut, FileText, Clock, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { DoctorService } from '../../lib/services/doctor';
import { AccessRequest } from '../../types';

export default function DoctorDashboard() {
  const { doctor, logout } = useAuthStore();
  const router = useRouter();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = async () => {
    if (!doctor) return;
    try {
      const data = await DoctorService.getRequests(doctor.id);
      setRequests(data);
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchRequests();
    }, [doctor])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock color={Colors.warning} size={20} />;
      case 'approved': return <CheckCircle2 color={Colors.success} size={20} />;
      case 'expired': return <AlertCircle color={Colors.error} size={20} />;
      default: return <FileText color={Colors.textSecondary} size={20} />;
    }
  };

  const navigateToRequest = (req: AccessRequest) => {
    router.push(`/(doctor)/access-request?patientId=${req.patient_id}&requestId=${req.id}`);
  };

  if (!doctor) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Verified Provider</Text>
            <Text style={styles.name}>{doctor.name}</Text>
          </View>
          <LogOut color={Colors.textSecondary} size={24} onPress={() => { logout(); router.replace('/'); }} />
        </View>

        <View style={styles.actionSection}>
          <View style={styles.iconWrapper}>
            <ScanFace color={Colors.primary} size={48} />
          </View>
          <Text style={styles.actionTitle}>Scan MediQR</Text>
          <Text style={styles.actionSubtitle}>
            Scan a patient's code to request access to their secure medical file.
          </Text>
          <Button
            title="Open Scanner"
            onPress={() => router.push('/(doctor)/scan')}
            style={styles.scanButton}
          />
        </View>

        <View style={styles.requestsSection}>
          <Text style={styles.sectionTitle}>MY PENDING REQUESTS</Text>
          {requests.length === 0 ? (
            <Text style={styles.emptyText}>No recent requests found.</Text>
          ) : (
            <View style={styles.list}>
              {requests.map(req => (
                <View key={req.id} style={styles.requestCard}>
                  <View style={styles.requestInfo}>
                    <View style={styles.requestHeader}>
                      {getStatusIcon(req.status)}
                      <Text style={[styles.statusText, styles[`status_${req.status}` as keyof typeof styles]]}>
                        {req.status.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.patientId}>Patient: {req.patient_id}</Text>
                    <Text style={styles.timestamp}>{new Date(req.created_at).toLocaleString()}</Text>
                  </View>
                  
                  {req.status === 'pending' && (
                    <Button 
                      title="View" 
                      variant="outline"
                      onPress={() => navigateToRequest(req)}
                      style={styles.actionBtn}
                    />
                  )}
                  {req.status === 'expired' && (
                    <Button 
                      title="Emergency Action" 
                      variant="danger"
                      onPress={() => router.push(`/(doctor)/emergency-confirm?patientId=${req.patient_id}`)}
                      style={styles.actionBtn}
                    />
                  )}
                  {req.status === 'approved' && (
                    <Button 
                      title="Open File" 
                      variant="primary"
                      onPress={() => router.push(`/(doctor)/medical-data?patientId=${req.patient_id}`)}
                      style={styles.actionBtn}
                    />
                  )}
                </View>
              ))}
            </View>
          )}
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
  content: {
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
    color: Colors.primaryLight,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    ...Typography.h1,
    color: Colors.text,
  },
  actionSection: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  actionTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  actionSubtitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.md,
  },
  scanButton: {
    width: '100%',
  },
  requestsSection: {
    padding: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    marginBottom: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  list: {
    gap: Spacing.md,
  },
  requestCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  requestInfo: {
    flex: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  statusText: {
    ...Typography.smallMedium,
  },
  status_pending: { color: Colors.warning },
  status_approved: { color: Colors.success },
  status_expired: { color: Colors.error },
  patientId: {
    ...Typography.bodyMedium,
    color: Colors.text,
    marginBottom: 2,
  },
  timestamp: {
    ...Typography.metadata,
    color: Colors.textSecondary,
  },
  actionBtn: {
    marginLeft: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 36,
    minHeight: 36, // Override global minHeight if applicable
  }
});
