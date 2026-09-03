import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/useAuthStore';
import { DoctorService } from '../../lib/services/doctor';
import { DEMO_DOCTOR_ID } from '../../lib/services/sharedDb';
import { Pill, Plus, Trash2 } from 'lucide-react-native';

interface MedInput {
  name: string;
  dosage: string;
  frequency: string;
}

export default function AddPrescriptionScreen() {
  const { patientId } = useLocalSearchParams();
  const router = useRouter();
  const { doctor } = useAuthStore();
  const effectiveDoctor = doctor || { id: DEMO_DOCTOR_ID, name: 'Dr. Sarah Adams' };
  
  const [medicines, setMedicines] = useState<MedInput[]>([{ name: '', dosage: '', frequency: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    // Validate
    const hasEmpty = medicines.some(m => !m.name?.trim() || !m.dosage?.trim() || !m.frequency?.trim());
    if (hasEmpty) {
      setError('Please fill out all fields for every medicine');
      return;
    }
    
    if (!patientId) {
      setError('Patient ID is missing');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formattedPrescription = {
        prescribing_doctor: effectiveDoctor.name,
        date: new Date().toISOString().split('T')[0],
        is_current: true,
        medicines: medicines.map(m => ({
          name: m.name.trim(),
          dosage: `${m.dosage.trim()} (${m.frequency.trim()})`
        }))
      };

      await DoctorService.addPrescription(patientId as string, effectiveDoctor.id, formattedPrescription);
      
      if (Platform.OS !== 'web') {
        const Haptics = await import('expo-haptics');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      router.back();
    } catch (e: any) {
      setError(e.message || 'Failed to add prescription');
    } finally {
      setLoading(false);
    }
  };

  const updateMed = (index: number, field: keyof MedInput, value: string) => {
    const newMeds = [...medicines];
    newMeds[index][field] = value;
    setMedicines(newMeds);
  };

  const removeMed = (index: number) => {
    if (medicines.length === 1) return;
    const newMeds = [...medicines];
    newMeds.splice(index, 1);
    setMedicines(newMeds);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Pill color={Colors.primary} size={48} />
          </View>
          <Text style={styles.title}>New Prescription</Text>
          <Text style={styles.subtitle}>Prescribe medication for {patientId}</Text>
        </View>

        <View style={styles.form}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          
          {medicines.map((med, index) => (
            <View key={index} style={styles.medCard}>
              <View style={styles.medCardHeader}>
                <Text style={styles.medCardTitle}>Medicine {index + 1}</Text>
                {medicines.length > 1 && (
                  <TouchableOpacity onPress={() => removeMed(index)} style={styles.removeBtn}>
                    <Trash2 size={20} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              <Input 
                label="Medicine Name" 
                placeholder="e.g. Amoxicillin" 
                value={med.name} 
                onChangeText={(v) => updateMed(index, 'name', v)} 
                autoCapitalize="words"
              />
              
              <View style={{ marginTop: Spacing.md }}>
                <Input 
                  label="Dose" 
                  placeholder="e.g. 500mg" 
                  value={med.dosage} 
                  onChangeText={(v) => updateMed(index, 'dosage', v)} 
                />
              </View>

              <View style={{ marginTop: Spacing.md }}>
                <Input 
                  label="Frequency (Times a day)" 
                  placeholder="e.g. Twice daily after meals" 
                  value={med.frequency} 
                  onChangeText={(v) => updateMed(index, 'frequency', v)} 
                />
              </View>
            </View>
          ))}

          <Button 
            title="Add Another Medicine" 
            variant="outline"
            icon={<Plus size={18} color={Colors.primary} />}
            onPress={() => setMedicines([...medicines, { name: '', dosage: '', frequency: '' }])} 
            style={styles.addMoreBtn}
          />
        </View>

        <View style={styles.actions}>
          <Button 
            title="Issue Prescription" 
            onPress={handleSave} 
            isLoading={loading}
            style={styles.button} 
          />
          <Button 
            title="Cancel" 
            variant="ghost" 
            onPress={() => router.back()} 
            style={styles.button} 
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  form: {
    marginBottom: Spacing.xl,
  },
  actions: {
    gap: Spacing.md,
  },
  button: {
    width: '100%',
  },
  errorText: {
    ...Typography.smallMedium,
    color: Colors.error,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  medCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  medCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  medCardTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  removeBtn: {
    padding: Spacing.xs,
  },
  addMoreBtn: {
    width: '100%',
    marginTop: Spacing.sm,
  },
});
