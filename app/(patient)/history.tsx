import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { useAuthStore } from '../../store/useAuthStore';
import { PatientService } from '../../lib/services/patient';
import { AuditLog } from '../../types';
import { AlertCircle, FileEdit, UserCheck, ShieldAlert, XCircle, Flag } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';

export default function HistoryScreen() {
  const { patient } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    if (!patient) return;
    try {
      const data = await PatientService.getAccessHistory(patient.id);
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    if (patient) {
      const unsubscribe = PatientService.subscribeToHistory(patient.id, () => {
        fetchLogs(); // Refetch on new event
      });
      return () => unsubscribe();
    }
  }, [patient]);

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

  const renderIcon = (type: string) => {
    switch (type) {
      case 'edit_data': return <FileEdit color={Colors.textSecondary} size={24} />;
      case 'normal_view': return <UserCheck color={Colors.success} size={24} />;
      case 'emergency_view': return <ShieldAlert color={Colors.error} size={24} />;
      case 'request_expired': return <XCircle color={Colors.textMuted} size={24} />;
      default: return <AlertCircle color={Colors.textSecondary} size={24} />;
    }
  };

  const renderItem = ({ item }: { item: AuditLog }) => {
    const isEmergency = item.type === 'emergency_view';
    const date = new Date(item.timestamp).toLocaleString();
    
    return (
      <View style={[styles.card, isEmergency && styles.emergencyCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            {renderIcon(item.type)}
            <Text style={[styles.title, isEmergency && { color: Colors.error }]}>
              {item.type === 'emergency_view' ? 'EMERGENCY ACCESS' :
               item.type === 'normal_view' ? 'Normal Access Granted' :
               item.type === 'edit_data' ? 'Medical Data Updated' :
               item.type === 'request_expired' ? 'Request Expired' : 'Activity Logged'}
            </Text>
          </View>
          <Text style={styles.timestamp}>{date}</Text>
        </View>

        {item.doctor_id && (
          <Text style={styles.detailText}>Provider: <Text style={styles.bold}>{item.doctor_id}</Text></Text>
        )}

        {isEmergency && item.reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Clinical Justification:</Text>
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

  if (loading) {
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emergencyCard: {
    borderColor: Colors.error,
    borderWidth: 2,
    backgroundColor: Colors.errorSurface,
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
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
    flexShrink: 1,
  },
  timestamp: {
    ...Typography.metadata,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  detailText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  bold: {
    fontWeight: '600',
    color: Colors.text,
  },
  reasonBox: {
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  reasonLabel: {
    ...Typography.smallMedium,
    color: Colors.error,
    marginBottom: 2,
  },
  reasonText: {
    ...Typography.body,
    color: Colors.text,
  },
  reportSection: {
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,0,0,0.1)',
    paddingTop: Spacing.md,
  },
  reportBtn: {
    height: 40,
    minHeight: 40,
  },
  reportedText: {
    ...Typography.smallMedium,
    color: Colors.error,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
});
