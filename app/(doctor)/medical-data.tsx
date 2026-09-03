import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { PatientService } from '../../lib/services/patient';
import { SHARED_DB } from '../../lib/services/sharedDb';
import { Patient } from '../../types';
import { ShieldAlert, Info, Clock, Pill } from 'lucide-react-native';
import { Badge } from '../../components/ui/Badge';
import { Divider } from '../../components/ui/Divider';
import { Button } from '../../components/ui/Button';

export default function MedicalDataScreen() {
  const { patientId, limited } = useLocalSearchParams();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isLimited = limited === 'true';

  const loadData = async () => {
    try {
      const data = await PatientService.getPatientData(patientId as string);
      setPatient({ ...data });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [patientId])
  );

  // Live subscription: updates automatically when prescription is added
  useEffect(() => {
    const unsub = SHARED_DB.subscribe(() => {
      loadData();
    });
    return () => unsub();
  }, [patientId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load patient data</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {isLimited && (
        <View style={styles.emergencyBanner}>
          <ShieldAlert color={Colors.white} size={24} />
          <Text style={styles.emergencyText}>EMERGENCY ACCESS — LOGGED</Text>
        </View>
      )}
      
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.patientName}>{patient.name}</Text>
          <Text style={styles.patientId}>ID: {patient.id}</Text>
        </View>
        {!isLimited && (
          <Button 
            title="Prescribe" 
            onPress={() => router.push(`/(doctor)/add-prescription?patientId=${patient.id}`)}
            icon={<Pill size={16} color={Colors.white} />}
            style={styles.headerActionBtn}
            textStyle={{ fontSize: 14 }}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BLOOD GROUP</Text>
        <Text style={styles.dataHero}>{patient.blood_group}</Text>
      </View>
      <Divider style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ALLERGIES</Text>
        {patient.allergies.length > 0 ? patient.allergies.map((allergy, i) => (
          <View key={i} style={styles.listItem}>
            <Text style={styles.listText}>{allergy.name}</Text>
            <Badge 
              label={allergy.severity} 
              variant={allergy.severity === 'severe' ? 'error' : (allergy.severity === 'moderate' ? 'warning' : 'neutral')} 
            />
          </View>
        )) : <Text style={styles.emptyText}>No known allergies</Text>}
      </View>
      <Divider style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CONDITIONS</Text>
        {patient.conditions.length > 0 ? patient.conditions.map((condition, i) => (
          <View key={i} style={styles.listItem}>
            <Text style={styles.listText}>{condition}</Text>
          </View>
        )) : <Text style={styles.emptyText}>No known conditions</Text>}
      </View>
      <Divider style={styles.divider} />

      {!isLimited && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MEDICATIONS (SELF-REPORTED)</Text>
            {patient.medications && patient.medications.length > 0 ? patient.medications.map((medication, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.listText}>{medication}</Text>
              </View>
            )) : <Text style={styles.emptyText}>No medications reported</Text>}
          </View>
          <Divider style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CURRENT PRESCRIPTIONS</Text>
            {patient.prescriptions && patient.prescriptions.filter(p => p.is_current).length > 0 ? patient.prescriptions.filter(p => p.is_current).map((script, i) => {
              const meds = script.medicines || (script.name ? [{ name: script.name, dosage: script.dosage }] : []);
              return (
                <View key={i} style={styles.prescriptionItem}>
                  {meds.map((med: any, mIdx: number) => (
                    <View key={mIdx} style={styles.prescriptionHeader}>
                      <Text style={styles.prescriptionName}>{med.name}</Text>
                      <Text style={styles.prescriptionDosage}>{med.dosage}</Text>
                    </View>
                  ))}
                  <View style={styles.prescriptionFooter}>
                    <Text style={styles.prescriptionMeta}>By {script.prescribing_doctor}</Text>
                    <Text style={styles.prescriptionMeta}>{script.date}</Text>
                  </View>
                </View>
              );
            }) : <Text style={styles.emptyText}>No current prescriptions found</Text>}
          </View>
          <Divider style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PAST PRESCRIPTIONS</Text>
            {patient.prescriptions && patient.prescriptions.filter(p => !p.is_current).length > 0 ? patient.prescriptions.filter(p => !p.is_current).map((script, i) => {
              const meds = script.medicines || (script.name ? [{ name: script.name, dosage: script.dosage }] : []);
              return (
                <View key={i} style={styles.prescriptionItem}>
                  {meds.map((med: any, mIdx: number) => (
                    <View key={mIdx} style={styles.prescriptionHeader}>
                      <Text style={styles.prescriptionName}>{med.name}</Text>
                      <Text style={styles.prescriptionDosage}>{med.dosage}</Text>
                    </View>
                  ))}
                  <View style={styles.prescriptionFooter}>
                    <Text style={styles.prescriptionMeta}>By {script.prescribing_doctor}</Text>
                    <Text style={styles.prescriptionMeta}>{script.date}</Text>
                  </View>
                </View>
              );
            }) : <Text style={styles.emptyText}>No previous prescriptions found</Text>}
          </View>
          <Divider style={styles.divider} />
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EMERGENCY CONTACT</Text>
        <View style={styles.contactCard}>
          <Text style={styles.contactName}>{patient.emergency_contact.name}</Text>
          <Text style={styles.contactRelation}>{patient.emergency_contact.relation}</Text>
          <Text style={styles.contactPhone}>{patient.emergency_contact.phone}</Text>
        </View>
      </View>

      {!isLimited && (
        <View style={styles.metadataSection}>
          <View style={styles.metaRow}>
            <Info size={16} color={Colors.textMuted} />
            <Text style={styles.metaText}>Source: {patient.data_source}</Text>
          </View>
          <View style={styles.metaRow}>
            <Clock size={16} color={Colors.textMuted} />
            <Text style={styles.metaText}>Updated: {new Date(patient.last_updated).toLocaleDateString()}</Text>
          </View>
        </View>
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
    paddingBottom: Spacing.xxxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    ...Typography.bodyMedium,
    color: Colors.error,
  },
  emergencyBanner: {
    backgroundColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  emergencyText: {
    ...Typography.smallMedium,
    color: Colors.white,
    textTransform: 'uppercase',
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActionBtn: {
    paddingHorizontal: Spacing.md,
    height: 36,
    minHeight: 36,
    borderRadius: BorderRadius.full,
  },
  patientName: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: 4,
  },
  patientId: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  section: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
    marginBottom: Spacing.sm,
  },
  dataHero: {
    ...Typography.h1,
    color: Colors.primary,
    fontSize: 48,
    lineHeight: 48,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  prescriptionItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  prescriptionName: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  prescriptionDosage: {
    ...Typography.smallMedium,
    color: Colors.primary,
  },
  prescriptionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  prescriptionMeta: {
    ...Typography.metadata,
  },
  listText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    flex: 1,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  divider: {
    marginHorizontal: Spacing.xl,
  },
  contactCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactName: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: 2,
  },
  contactRelation: {
    ...Typography.smallMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  contactPhone: {
    ...Typography.bodyLarge,
    color: Colors.primary,
  },
  metadataSection: {
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    marginTop: Spacing.xl,
    gap: Spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.metadata,
    color: Colors.textMuted,
  },
});
