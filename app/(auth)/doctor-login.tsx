import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Colors, Typography, Spacing } from '../../constants/Theme';
import { DoctorService } from '../../lib/services/doctor';
import { useAuthStore } from '../../store/useAuthStore';

const doctorLoginSchema = z.object({
  doctorId: z.string().min(2, 'Doctor ID is required'),
});

type DoctorLoginFormData = z.infer<typeof doctorLoginSchema>;

export default function DoctorLoginScreen() {
  const router = useRouter();
  const { loginDoctor } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const { control, handleSubmit, formState: { errors } } = useForm<DoctorLoginFormData>({
    resolver: zodResolver(doctorLoginSchema),
    defaultValues: { doctorId: '' }
  });

  const onSubmit = async (data: DoctorLoginFormData) => {
    try {
      setLoading(true);
      setServerError('');
      const doctor = await DoctorService.login(data.doctorId);
      loginDoctor(doctor);
      router.replace('/(doctor)/dashboard');
    } catch (err: any) {
      setServerError('Failed to verify ID. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Provider Access</Text>
            <Text style={styles.subtitle}>Enter your certified provider ID to continue.</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="doctorId"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Provider ID"
                  placeholder="e.g. d-67890"
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="none"
                  error={errors.doctorId?.message}
                />
              )}
            />
            
            {serverError ? <Text style={styles.errorText}>{serverError}</Text> : null}

            <Button
              title="Verify & Continue"
              onPress={handleSubmit(onSubmit)}
              isLoading={loading}
              style={styles.submitButton}
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
  },
  header: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
  },
  form: {
    gap: Spacing.sm,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  errorText: {
    ...Typography.small,
    color: Colors.error,
    marginBottom: Spacing.sm,
  },
});
