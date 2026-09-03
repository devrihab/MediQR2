import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Scan, Flashlight, FlashlightOff, Camera as CameraIcon, ShieldCheck, Keyboard } from 'lucide-react-native';
import { SHARED_DB } from '../../lib/services/sharedDb';

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [showManual, setShowManual] = useState(false);
  
  const [activePatient, setActivePatient] = useState(() => SHARED_DB.getLatestPatient());
  const [manualId, setManualId] = useState(() => SHARED_DB.getLatestPatient().id);

  useEffect(() => {
    const p = SHARED_DB.getLatestPatient();
    setActivePatient(p);
    setManualId(p.id);

    const unsub = SHARED_DB.subscribe(() => {
      const updated = SHARED_DB.getLatestPatient();
      setActivePatient(updated);
      setManualId(updated.id);
    });
    return () => unsub();
  }, []);

  // Extract Patient ID from raw QR text or full web URL
  const extractPatientId = (raw: string): string => {
    if (!raw) return '';
    const trimmed = raw.trim();

    // Check for encoded full patient payload: mediqr://patient?data=...
    if (trimmed.includes('data=')) {
      try {
        const dataPart = trimmed.split('data=')[1].split('&')[0];
        const parsed = JSON.parse(decodeURIComponent(dataPart));
        if (parsed && parsed.id) {
          SHARED_DB.setPatient(parsed);
          return parsed.id;
        }
      } catch (e) {}
    }

    // Check for URL query parameter: ?patientId=UUID
    if (trimmed.includes('patientId=')) {
      try {
        const url = new URL(trimmed);
        const id = url.searchParams.get('patientId');
        if (id) return id;
      } catch {
        const match = trimmed.match(/patientId=([^&]+)/);
        if (match && match[1]) return match[1];
      }
    }

    // Check for standard UUID in string
    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
    const match = trimmed.match(uuidRegex);
    if (match) {
      return match[0];
    }

    return trimmed;
  };

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);

    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }

    const patientId = extractPatientId(result.data);
    router.push(`/(doctor)/access-request?patientId=${patientId}`);
  };

  const handleManualSubmit = () => {
    const patientId = extractPatientId(manualId);
    router.push(`/(doctor)/access-request?patientId=${patientId}`);
  };

  useEffect(() => {
    let sub: any;
    if (Platform.OS !== 'web') {
      try {
        sub = CameraView.onModernBarcodeScanned((result) => {
          if (result && result.data) {
            handleBarcodeScanned({ data: result.data, type: 'qr' } as any);
          }
        });
      } catch (e) {}
    }
    return () => {
      sub?.remove?.();
    };
  }, []);

  const handleLaunchNativeScanner = async () => {
    try {
      if (Platform.OS !== 'web') {
        await CameraView.launchScanner({ barcodeTypes: ['qr'] });
      }
    } catch (e) {
      console.log('Native scanner error:', e);
    }
  };

  // Permission still loading
  if (!permission) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Initializing camera...</Text>
      </View>
    );
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <View style={styles.iconCircle}>
          <CameraIcon size={48} color={Colors.primary} />
        </View>
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionDesc}>
          MediQR needs camera access to scan patient QR codes securely and initiate clinical access.
        </Text>

        <Button
          title="Enable Camera Access"
          onPress={requestPermission}
          style={{ width: '100%', marginBottom: Spacing.md }}
        />

        <Button
          title="Enter Patient ID Manually"
          variant="outline"
          onPress={() => setShowManual(true)}
          style={{ width: '100%' }}
        />

        {showManual && (
          <View style={styles.manualFallbackBox}>
            <Input
              label="Patient ID or QR Code"
              value={manualId}
              onChangeText={setManualId}
              autoCapitalize="none"
            />
            <Button
              title="Proceed to Request Access"
              onPress={handleManualSubmit}
              style={{ marginTop: Spacing.sm }}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Real-time Camera View with Continuous Autofocus */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        autofocus="on"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onMountError={() => {
          setShowManual(true);
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Target Framing Overlay */}
      <View style={styles.overlay}>
        {/* Top Header & Controls */}
        <View style={[styles.topControls, { paddingTop: Math.max(insets.top, Spacing.lg) }]}>
          <View style={styles.badgeRow}>
            <ShieldCheck size={16} color={Colors.success} />
            <Text style={styles.badgeText}>MediQR Scanner Active</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                style={styles.torchBtn}
                onPress={handleLaunchNativeScanner}
                activeOpacity={0.8}
              >
                <CameraIcon size={20} color={Colors.white} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.torchBtn}
              onPress={() => setTorch(!torch)}
              activeOpacity={0.8}
            >
              {torch ? (
                <FlashlightOff size={22} color={Colors.white} />
              ) : (
                <Flashlight size={22} color={Colors.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Center Scanner Window */}
        <View style={styles.scanTargetContainer}>
          <View style={styles.scanWindow}>
            {/* 4 Corner Markers */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {scanned && (
              <View style={styles.scannedBanner}>
                <ActivityIndicator color={Colors.white} size="small" />
                <Text style={styles.scannedText}>Patient Found...</Text>
              </View>
            )}
          </View>
          <Text style={styles.instructionText}>Align patient's QR code within the frame</Text>
        </View>

        {/* Bottom Drawer / Quick Scan Bar */}
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
          ]}
        >
          <Button
            title={`⚡ Simulate QR Scan (${activePatient.name})`}
            onPress={handleManualSubmit}
            style={{ marginBottom: Spacing.sm, width: '100%' }}
          />

          {showManual ? (
            <View style={styles.manualBox}>
              <Text style={styles.manualTitle}>Manual Patient Identification</Text>
              <Input
                placeholder="Paste Patient ID or QR URL"
                value={manualId}
                onChangeText={setManualId}
                autoCapitalize="none"
              />
              <View style={styles.manualActionRow}>
                <Button
                  title="Simulate Scan"
                  onPress={handleManualSubmit}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Hide"
                  variant="ghost"
                  onPress={() => setShowManual(false)}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.openManualBtn}
              onPress={() => setShowManual(true)}
              activeOpacity={0.8}
            >
              <Keyboard size={18} color={Colors.white} />
              <Text style={styles.openManualText}>Enter ID Manually / Simulator</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.white,
    marginTop: Spacing.md,
  },
  permissionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    backgroundColor: Colors.background,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  permissionTitle: {
    ...Typography.h2,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  permissionDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  manualFallbackBox: {
    width: '100%',
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    ...Typography.smallMedium,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  torchBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTargetContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanWindow: {
    width: 260,
    height: 260,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: Colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  instructionText: {
    ...Typography.bodyMedium,
    color: Colors.white,
    marginTop: Spacing.lg,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  scannedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  scannedText: {
    ...Typography.smallMedium,
    color: Colors.white,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  openManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  openManualText: {
    ...Typography.smallMedium,
    color: Colors.white,
  },
  manualBox: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  manualTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  manualActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
