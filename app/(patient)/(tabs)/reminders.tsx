import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors, Typography, Spacing, BorderRadius } from '../../../constants/Theme';
import { useAuthStore } from '../../../store/useAuthStore';
import { Bell, CheckCircle2, Circle } from 'lucide-react-native';

export default function RemindersScreen() {
  const { patient } = useAuthStore();
  const [takenMeds, setTakenMeds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!patient) return;
    const loadReminders = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const key = `meds_${patient.id}_${today}`;
        const stored = await SecureStore.getItemAsync(key);
        if (stored) {
          setTakenMeds(JSON.parse(stored));
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadReminders();
  }, [patient]);

  const toggleMedication = async (medName: string) => {
    if (!patient) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `meds_${patient.id}_${today}`;

      const newState = {
        ...takenMeds,
        [medName]: !takenMeds[medName]
      };

      setTakenMeds(newState);
      await SecureStore.setItemAsync(key, JSON.stringify(newState));

      if (newState[medName]) {
        // Haptic feedback for taking medicine
        const Haptics = await import('expo-haptics');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!patient) return null;

  const meds = patient.medications || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Daily Schedule</Text>
        <Text style={styles.headerSubtitle}>Tap to mark your medicines as taken</Text>
      </View>

      {meds.length > 0 ? (
        meds.map((med, i) => {
          const isTaken = !!takenMeds[med];
          return (
            <TouchableOpacity
              key={i}
              style={[styles.card, isTaken && styles.cardTaken]}
              activeOpacity={0.7}
              onPress={() => toggleMedication(med)}
            >
              <View style={styles.cardContent}>
                <View>
                  <Text style={[styles.medName, isTaken && styles.textTaken]}>{med}</Text>
                  <Text style={styles.medTime}>{isTaken ? 'Taken today' : 'Scheduled for today'}</Text>
                </View>
                {isTaken ? (
                  <CheckCircle2 size={32} color={Colors.success} />
                ) : (
                  <Circle size={32} color={Colors.border} />
                )}
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyState}>
          <Bell size={48} color={Colors.textMuted} style={{ marginBottom: Spacing.md }} />
          <Text style={styles.emptyText}>No active medications to remind you about.</Text>
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
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTaken: {
    backgroundColor: Colors.successSurface,
    borderColor: Colors.success,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medName: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  textTaken: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
  },
  medTime: {
    ...Typography.smallMedium,
    color: Colors.textSecondary,
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
