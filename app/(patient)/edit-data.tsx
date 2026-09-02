import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../store/useAuthStore';
import { PatientService } from '../../lib/services/patient';
import { Colors, Typography, Spacing } from '../../constants/Theme';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Divider } from '../../components/ui/Divider';
import { Trash2, Plus } from 'lucide-react-native';

const editSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  blood_group: z.string().min(1, 'Blood group is required'),
  allergies: z.array(z.object({
    name: z.string().min(1, 'Required'),
    severity: z.enum(['mild', 'moderate', 'severe']),
  })),
  conditions: z.array(z.object({ value: z.string().min(1, 'Required') })),
  medications: z.array(z.object({ value: z.string() })).optional(),
  emergency_contact: z.object({
    name: z.string().min(2, 'Required'),
    phone: z.string().min(5, 'Required'),
    relation: z.string().optional(),
  })
});

type EditFormData = z.infer<typeof editSchema>;

export default function EditDataScreen() {
  const router = useRouter();
  const { patient, loginPatient } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const { control, handleSubmit, formState: { errors } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: patient?.name || '',
      email: patient?.email || '',
      blood_group: patient?.blood_group || '',
      allergies: patient?.allergies || [],
      conditions: (patient?.conditions || []).map(c => ({ value: c })),
      medications: (patient?.medications || []).map(m => ({ value: m })),
      emergency_contact: patient?.emergency_contact || { name: '', phone: '', relation: '' }
    }
  });

  const { fields: allergyFields, append: addAllergy, remove: removeAllergy } = useFieldArray({ control, name: 'allergies' });
  const { fields: conditionFields, append: addCondition, remove: removeCondition } = useFieldArray({ control, name: 'conditions' });
  const { fields: medFields, append: addMed, remove: removeMed } = useFieldArray({ control, name: 'medications' });

  const onSubmit = async (data: EditFormData) => {
    if (!patient) return;
    try {
      setLoading(true);
      setServerError('');
      const updatedPatient = {
        ...patient,
        name: data.name,
        email: data.email,
        blood_group: data.blood_group,
        allergies: data.allergies,
        conditions: data.conditions.map(c => c.value),
        medications: (data.medications || []).map(m => m.value).filter(Boolean),
        emergency_contact: {
          name: data.emergency_contact.name,
          phone: data.emergency_contact.phone,
          relation: data.emergency_contact.relation || 'Contact',
        }
      };
      
      const newPatient = await PatientService.updatePatient(updatedPatient);
      loginPatient(newPatient); // Update local store
      router.back();
    } catch (err: any) {
      setServerError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Update Identity</Text>
        <Text style={styles.subtitle}>Keep your medical information current.</Text>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>BASIC DETAILS</Text>
          <Controller control={control} name="name" render={({ field: { onChange, value } }) => (
            <Input label="Full Name" value={value} onChangeText={onChange} error={errors.name?.message} />
          )} />
          <Controller control={control} name="email" render={({ field: { onChange, value } }) => (
            <Input label="Email Address" value={value} onChangeText={onChange} autoCapitalize="none" error={errors.email?.message} />
          )} />
          <Controller control={control} name="blood_group" render={({ field: { onChange, value } }) => (
            <Input label="Blood Group (Required)" placeholder="e.g. O+, AB-" value={value} onChangeText={onChange} error={errors.blood_group?.message} />
          )} />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.formSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>ALLERGIES</Text>
            <TouchableOpacity onPress={() => addAllergy({ name: '', severity: 'moderate' })}><Plus color={Colors.primary} size={20} /></TouchableOpacity>
          </View>
          {allergyFields.map((field, index) => (
            <View key={field.id} style={styles.arrayRow}>
              <View style={styles.arrayInputs}>
                <Controller control={control} name={`allergies.${index}.name`} render={({ field: { onChange, value } }) => (
                  <Input placeholder="Allergy name" value={value} onChangeText={onChange} error={errors.allergies?.[index]?.name?.message} />
                )} />
                <Controller control={control} name={`allergies.${index}.severity`} render={({ field: { onChange, value } }) => (
                  <Select 
                    placeholder="Select Severity" 
                    value={value} 
                    onSelect={onChange} 
                    options={[
                      { label: 'Mild', value: 'mild' },
                      { label: 'Moderate', value: 'moderate' },
                      { label: 'Severe', value: 'severe' },
                    ]}
                    error={errors.allergies?.[index]?.severity?.message} 
                  />
                )} />
              </View>
              <TouchableOpacity onPress={() => removeAllergy(index)} style={styles.deleteBtn}><Trash2 color={Colors.error} size={20} /></TouchableOpacity>
            </View>
          ))}
          {allergyFields.length === 0 && <Text style={styles.emptyText}>No allergies added.</Text>}
        </View>

        <Divider style={styles.divider} />

        <View style={styles.formSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>CONDITIONS</Text>
            <TouchableOpacity onPress={() => addCondition({ value: '' })}><Plus color={Colors.primary} size={20} /></TouchableOpacity>
          </View>
          {conditionFields.map((field, index) => (
            <View key={field.id} style={styles.arrayRow}>
              <View style={{ flex: 1 }}>
                <Controller control={control} name={`conditions.${index}.value`} render={({ field: { onChange, value } }) => (
                  <Input placeholder="Condition" value={value} onChangeText={onChange} error={errors.conditions?.[index]?.value?.message} />
                )} />
              </View>
              <TouchableOpacity onPress={() => removeCondition(index)} style={styles.deleteBtn}><Trash2 color={Colors.error} size={20} /></TouchableOpacity>
            </View>
          ))}
          {conditionFields.length === 0 && <Text style={styles.emptyText}>No conditions added.</Text>}
        </View>

        <Divider style={styles.divider} />

        <View style={styles.formSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>MEDICATIONS (OPTIONAL)</Text>
            <TouchableOpacity onPress={() => addMed({ value: '' })}><Plus color={Colors.primary} size={20} /></TouchableOpacity>
          </View>
          {medFields.map((field, index) => (
            <View key={field.id} style={styles.arrayRow}>
              <View style={{ flex: 1 }}>
                <Controller control={control} name={`medications.${index}.value`} render={({ field: { onChange, value } }) => (
                  <Input placeholder="Medication name" value={value} onChangeText={onChange} />
                )} />
              </View>
              <TouchableOpacity onPress={() => removeMed(index)} style={styles.deleteBtn}><Trash2 color={Colors.error} size={20} /></TouchableOpacity>
            </View>
          ))}
        </View>

        <Divider style={styles.divider} />

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>EMERGENCY CONTACT</Text>
          <Controller control={control} name="emergency_contact.name" render={({ field: { onChange, value } }) => (
            <Input label="Contact Name" value={value} onChangeText={onChange} error={errors.emergency_contact?.name?.message} />
          )} />
          <Controller control={control} name="emergency_contact.phone" render={({ field: { onChange, value } }) => (
            <Input label="Contact Phone" value={value} onChangeText={onChange} keyboardType="phone-pad" error={errors.emergency_contact?.phone?.message} />
          )} />
          <Controller control={control} name="emergency_contact.relation" render={({ field: { onChange, value } }) => (
            <Input label="Relation (Optional)" value={value} onChangeText={onChange} />
          )} />
        </View>

        {serverError ? <Text style={styles.errorText}>{serverError}</Text> : null}
        
        <Button title="Save Changes" onPress={handleSubmit(onSubmit)} isLoading={loading} style={styles.saveButton} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
    paddingBottom: Spacing.xxxl * 2,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
  },
  formSection: {
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.sectionHeader,
  },
  arrayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  arrayInputs: {
    flex: 1,
    gap: Spacing.sm,
  },
  deleteBtn: {
    padding: Spacing.sm,
    justifyContent: 'center',
  },
  divider: {
    marginVertical: Spacing.xl,
  },
  emptyText: {
    ...Typography.small,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  saveButton: {
    marginTop: Spacing.xl,
  },
  errorText: {
    ...Typography.small,
    color: Colors.error,
    marginTop: Spacing.md,
  },
});
