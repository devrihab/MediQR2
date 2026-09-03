import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { useAuthStore } from '../../store/useAuthStore';
import { PatientService } from '../../lib/services/patient';
import { AuditLog } from '../../types';
import { AlertCircle, FileEdit, UserCheck, ShieldAlert, XCircle, Flag, Pill } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';

export default function HistoryScreen() {
  const { patient } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async () => {
    if (!patient?.id) return;
    try {
      const data = await PatientService.getAccessHistory(patient.id);
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLogs();
    }, [patient?.id])
  );

  useEffect(() => {
    fetchLogs();
    
    if (patient?.id) {
      const unsubscribe = PatientService.subscribeToHistory(patient.id, () => {
        fetchLogs();
      });
      return () => unsubscribe();
    }
  }, [patient?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
  };

  const handleReport = async (logId: string) => {
    Alert.alert(
      "Report Emergency Access",
      "Are you sure you want to flag this access? A security dispute will be recorded.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Report", 
          style: "destructive",
          onPress: async () => {
            try {
              await PatientService.reportAccess(logId);
              setLogs(prev => prev.map(l => l.id === logId ? { ...l, is_reported: true } : l));
            } catch (err) {
              Alert.alert("Error", "Failed to report access.");
            }
          }
        }
      ]
    );
  };

  const renderIcon = (type: string, reason?: string | null) => {
    if (reason && reason.toLowerCase().includes('prescription')) {
      return <Pill color={Colors.primary} size={24} />;
    }
    switch (type) {
      case 'edit_data': return <FileEdit color={Colors.textSecondary} size={24} />;
      case 'normal_view': return <UserCheck color={Colors.success} size={24} />;
      case 'emergency_view': return <ShieldAlert color={Colors.error} size={24} />;
      case 'request_expired': return <XCircle color={Colors.textMuted} size={24} />;
      default: return <AlertCircle color={Colors.textSecondary} size={24} />;
    }
  };

  const getLogTitle = (type: string, reason?: string | null) => {
    if (reason && reason.toLowerCase().includes('prescription')) {
      return reason;
    }
    switch (type) {
      case 'emergency_view': return 'EMERGENCY ACCESS';
      case 'normal_view': return 'Doctor Access Granted';
      case 'edit_data': return 'Medical Data Updated';
      case 'request_expired': return 'Request Expired';
      default: return 'Activity Logged';
    }
  };

  const getDoctorDisplay = (doctorId?: string | null) => {
    if (!doctorId) return null;
    if (doctorId.includes('22222') || doctorId === '22222222-2222-2222-2222-222222222222') {
      return 'Dr. Sarah Adams';
    }
    return doctorId;
  };

  const renderItem = ({ item }: { item: AuditLog }) => {
    const isEmergency = item.type === 'emergency_view';
    const date = new Date(item.timestamp).toLocaleString();
    const docName = getDoctorDisplay(item.doctor_id);
    
    return (
      <View style={[styles.card, isEmergency && styles.emergencyCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            {renderIcon(item.type, item.reason)}
            <Text style={[styles.title, isEmergency && { color: Colors.error }]}>
              {getLogTitle(item.type, item.reason)}
            </Text>
          </View>
          <Text style={styles.timestamp}>{date}</Text>
        </View>

        {docName && (
          <Text style={styles.detailText}>Doctor: <Text style={styles.bold}>{docName}</Text></Text>
        )}

        {item.reason && !item.reason.toLowerCase().includes('prescription') && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>
              {isEmergency ? 'Clinical Justification:' : 'Details:'}
            </Text>
            <Text style={styles.reasonText}>{item.reason}</Text>
          </View>
        )}

        {isEmergency && (
          <View style={styles.reportSection}>
            {item.is_reported ? (
              <Text style={styles.reportedText}>This access has been flagged and reported.</Text>
            ) : (
              <Button 
                title="Report this access" 
                variant="outline"
                onPress={() => handleReport(item.id)}
                icon={<Flag size={16} color={Colors.primary} />}
                style={styles.reportBtn}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading && logs.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={logs}
        keyExtractor={item => item.id || Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No activity history found.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.xl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emergencyCard: {
    borderColor: Colors.error,
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    paddingRight: Spacing.sm,
  },
  title: {
    ...Typography.bodyMedium,
    color: Colors.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  timestamp: {
    ...Typography.metadata,
    color: Colors.textMuted,
  },
  detailText: {
    ...Typography.small,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  bold: {
    fontWeight: '700',
    color: Colors.text,
  },
  reasonBox: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  reasonLabel: {
    ...Typography.metadata,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontWeight: '600',
  },
  reasonText: {
    ...Typography.body,
    color: Colors.text,
  },
  reportSection: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  reportBtn: {
    marginTop: Spacing.xs,
  },
  reportedText: {
    ...Typography.small,
    color: Colors.error,
    fontWeight: '600',
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
});
