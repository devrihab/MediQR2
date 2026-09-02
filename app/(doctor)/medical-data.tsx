import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { PatientService } from '../../lib/services/patient';
import { Patient } from '../../types';
import { ShieldAlert, Info, Clock } from 'lucide-react-native';
import { Badge } from '../../components/ui/Badge';
import { Divider } from '../../components/ui/Divider';

export default function MedicalDataScreen() {
  const { patientId, limited } = useLocalSearchParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const isLimited = limited === 'true';

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await PatientService.getPatientData(patientId as string);
        setPatient(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [patientId]);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isLimited && (
        <View style={styles.emergencyBanner}>
          <ShieldAlert color={Colors.white} size={24} />
          <Text style={styles.emergencyText}>EMERGENCY ACCESS — LOGGED</Text>
        </View>
      )}
      
      <View style={styles.header}>
        <Text style={styles.patientName}>{patient.name}</Text>
        <Text style={styles.patientId}>ID: {patient.id}</Text>
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
            <Text style={styles.sectionTitle}>MEDICATIONS (CURRENT)</Text>
            {patient.medications && patient.medications.length > 0 ? patient.medications.map((medication, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.listText}>{medication}</Text>
              </View>
            )) : <Text style={styles.emptyText}>No medications reported</Text>}
          </View>
          <Divider style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PAST PRESCRIPTIONS</Text>
            {patient.prescriptions && patient.prescriptions.length > 0 ? patient.prescriptions.map((script, i) => (
              <View key={i} style={styles.prescriptionItem}>
                <View style={styles.prescriptionHeader}>
                  <Text style={styles.prescriptionName}>{script.name}</Text>
                  <Text style={styles.prescriptionDosage}>{script.dosage}</Text>
                </View>
                <View style={styles.prescriptionFooter}>
                  <Text style={styles.prescriptionMeta}>By {script.prescribing_doctor}</Text>
                  <Text style={styles.prescriptionMeta}>{script.date}</Text>
                </View>
              </View>
            )) : <Text style={styles.emptyText}>No previous prescriptions found</Text>}
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
