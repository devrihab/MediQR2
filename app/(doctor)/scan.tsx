import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Scan } from 'lucide-react-native';

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mockId, setMockId] = useState(process.env.EXPO_PUBLIC_DEMO_PATIENT_ID || '11111111-1111-1111-1111-111111111111');

  const handleSimulateScan = () => {
    // Navigate to access request screen with scanned ID
    router.push(`/(doctor)/access-request?patientId=${mockId}`);
  };

  return (
      <View style={styles.container}>
        <View style={styles.cameraPlaceholder}>
          <Scan color={Colors.white} size={64} style={styles.scanIcon} />
          <Text style={styles.cameraText}>Camera Active</Text>
          <Text style={styles.cameraSubtext}>Align QR code within the frame</Text>
        </View>
        
        <View style={[styles.simulatorContainer, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
          <Text style={styles.simTitle}>Development Simulator</Text>
          <Input 
            label="Simulated QR Value (Patient ID)" 
            value={mockId}
            onChangeText={setMockId}
            autoCapitalize="none"
          />
          <Button 
            title="Simulate Scan" 
            onPress={handleSimulateScan} 
          />
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.black, // Keep camera area black
  },
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  scanIcon: {
    marginBottom: Spacing.lg,
    opacity: 0.8,
  },
  cameraText: {
    ...Typography.h2,
    color: Colors.white,
  },
  cameraSubtext: {
    ...Typography.bodyLarge,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  simulatorContainer: {
    backgroundColor: Colors.background,
    padding: Spacing.xl,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
  },
  simTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
});
