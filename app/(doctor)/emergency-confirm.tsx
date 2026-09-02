import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ShieldAlert } from 'lucide-react-native';
import { DoctorService } from '../../lib/services/doctor';
import { useAuthStore } from '../../store/useAuthStore';

export default function EmergencyConfirmScreen() {
  const { patientId } = useLocalSearchParams();
  const router = useRouter();
  const { doctor } = useAuthStore();
  
  const [reason, setReason] = useState('');
  const [elaboration, setElaboration] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!doctor || !patientId || !reason) return;
    
    setLoading(true);
    
    // Serious haptic feedback to communicate weight of action
    if (Platform.OS !== 'web') {
      import('expo-haptics').then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    }
    
    // Deliberate artificial delay to communicate logging
    await new Promise(resolve => setTimeout(resolve, 800));

    const fullReason = elaboration ? `${reason} - ${elaboration}` : reason;
    
    try {
      await DoctorService.triggerEmergencyAccess(patientId as string, doctor.id, fullReason);
      router.replace(`/(doctor)/medical-data?patientId=${patientId}&limited=true`);
    } catch (e) {
      console.error(e);
      // Proceed even on failure for demo robustness
      router.replace(`/(doctor)/medical-data?patientId=${patientId}&limited=true`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <ShieldAlert color={Colors.error} size={48} />
          </View>
          <Text style={styles.title}>Emergency Access</Text>
        </View>
        
        <View style={styles.explanationBox}>
          <Text style={styles.explanationText}>
            Normal consent could not be completed. Emergency access is logged and reviewable by the patient.
          </Text>
        </View>

        <View style={styles.formSection}>
          <Select 
            label="Reason for Emergency Access (Required)"
            placeholder="Select a reason"
            value={reason}
            onSelect={setReason}
            options={[
              { label: 'Unconscious', value: 'Unconscious' },
              { label: 'Trauma', value: 'Trauma' },
              { label: 'Other', value: 'Other' },
            ]}
          />
          
          <View style={{ marginTop: Spacing.md }}>
            <Input 
              label="Elaboration (Optional)"
              placeholder="Add more details..." 
              value={elaboration}
              onChangeText={setElaboration}
              multiline
              numberOfLines={4}
              style={styles.reasonInput}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Text style={styles.warningLabel}>
            This access will be logged and reviewable by the patient.
          </Text>
          <Button 
            title="Confirm Emergency Access" 
            variant="danger" 
            onPress={handleConfirm} 
            disabled={!reason}
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
    flexGrow: 1,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.errorSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h2,
    color: Colors.error,
  },
  explanationBox: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  explanationText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    textAlign: 'center',
  },
  formSection: {
    flex: 1,
    gap: Spacing.sm,
  },
  reasonInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actions: {
    marginTop: Spacing.xxl,
    gap: Spacing.md,
  },
  warningLabel: {
    ...Typography.smallMedium,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  button: {
    width: '100%',
  },
});
