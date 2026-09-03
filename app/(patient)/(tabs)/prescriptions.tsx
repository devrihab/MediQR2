import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../../../constants/Theme';
import { useAuthStore } from '../../../store/useAuthStore';
import { PatientService } from '../../../lib/services/patient';
import { SHARED_DB } from '../../../lib/services/sharedDb';
import { supabase } from '../../../lib/supabase';

export default function PrescriptionsScreen() {
  const { patient, updatePatientProfile } = useAuthStore();
  const [prescriptions, setPrescriptions] = useState<any[]>(patient?.prescriptions || []);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLatestPrescriptions = async () => {
    if (!patient?.id) return;
    try {
      const freshData = await PatientService.getPatientData(patient.id);
      if (freshData && freshData.prescriptions) {
        setPrescriptions(freshData.prescriptions);
        updatePatientProfile({ prescriptions: freshData.prescriptions });
      }
    } catch (e) {
      console.error('Failed to refresh prescriptions:', e);
    }
  };

  // Re-fetch every time user switches to this tab
  useFocusEffect(
    useCallback(() => {
      fetchLatestPrescriptions();
    }, [patient?.id])
  );

  // Real-time listener for prescriptions added by doctor
  useEffect(() => {
    if (!patient?.id) return;

    const unsubShared = SHARED_DB.subscribe(() => {
      fetchLatestPrescriptions();
    });

    const channel = supabase
      .channel(`patient_prescriptions_${patient.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'patients', filter: `id=eq.${patient.id}` },
        payload => {
          if (payload.new && (payload.new as any).prescriptions) {
            setPrescriptions((payload.new as any).prescriptions);
            updatePatientProfile({ prescriptions: (payload.new as any).prescriptions });
          }
        }
      )
      .subscribe();

    return () => {
      unsubShared();
      supabase.removeChannel(channel);
    };
  }, [patient?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLatestPrescriptions();
    setRefreshing(false);
  };

  if (!patient) return null;

  const currentScripts = prescriptions.filter(p => p.is_current);
  const pastScripts = prescriptions.filter(p => !p.is_current);

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Prescriptions</Text>
        <Text style={styles.headerSubtitle}>Medications prescribed by doctors</Text>
      </View>

      <Text style={styles.sectionTitle}>Current</Text>
      {currentScripts.length > 0 ? (
        currentScripts.map((script, i) => {
          const meds = script.medicines || (script.name ? [{ name: script.name, dosage: script.dosage }] : []);
          return (
            <View key={`curr-${i}`} style={styles.card}>
              {meds.map((med: any, mIdx: number) => (
                <View key={mIdx} style={styles.cardHeader}>
                  <Text style={styles.name}>{med.name}</Text>
                  <Text style={styles.dosage}>{med.dosage}</Text>
                </View>
              ))}
              <View style={styles.cardFooter}>
                <Text style={styles.meta}>By {script.prescribing_doctor}</Text>
                <Text style={styles.meta}>{script.date}</Text>
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.emptyTextSimple}>No current prescriptions found.</Text>
      )}

      <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Past</Text>
      {pastScripts.length > 0 ? (
        pastScripts.map((script, i) => {
          const meds = script.medicines || (script.name ? [{ name: script.name, dosage: script.dosage }] : []);
          return (
            <View key={`past-${i}`} style={styles.card}>
              {meds.map((med: any, mIdx: number) => (
                <View key={mIdx} style={styles.cardHeader}>
                  <Text style={styles.name}>{med.name}</Text>
                  <Text style={styles.dosage}>{med.dosage}</Text>
                </View>
              ))}
              <View style={styles.cardFooter}>
                <Text style={styles.meta}>By {script.prescribing_doctor}</Text>
                <Text style={styles.meta}>{script.date}</Text>
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.emptyTextSimple}>No past prescriptions found.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.xl,
    marginTop: Spacing.xxl,
  },
  headerTitle: {
    ...Typography.h1,
    color: Colors.text,
  },
  headerSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.smallMedium,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
    letterSpacing: 1,
  },
  emptyTextSimple: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  name: {
    ...Typography.h3,
    color: Colors.text,
  },
  dosage: {
    ...Typography.h3,
    color: Colors.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: {
    ...Typography.metadata,
  },
});
