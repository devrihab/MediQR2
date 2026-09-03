import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../../constants/Theme';
import { useAuthStore } from '../../../store/useAuthStore';
import { FileText } from 'lucide-react-native';

export default function PrescriptionsScreen() {
  const { patient } = useAuthStore();

  if (!patient) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Prescriptions</Text>
        <Text style={styles.headerSubtitle}>Medications prescribed by doctors</Text>
      </View>

      <Text style={styles.sectionTitle}>Current</Text>
      {patient.prescriptions && patient.prescriptions.filter(p => p.is_current).length > 0 ? (
        patient.prescriptions.filter(p => p.is_current).map((script, i) => {
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
      {patient.prescriptions && patient.prescriptions.filter(p => !p.is_current).length > 0 ? (
        patient.prescriptions.filter(p => !p.is_current).map((script, i) => {
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxxl,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
});
