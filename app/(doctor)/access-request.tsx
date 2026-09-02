import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, AppState, AppStateStatus, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ShieldAlert, ShieldCheck, Clock, CheckCircle2, XCircle, Send } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutUp, FadeIn, FadeOut } from 'react-native-reanimated';
import { DoctorService } from '../../lib/services/doctor';
import { useAuthStore } from '../../store/useAuthStore';
import { AccessRequest, AccessRequestStatus } from '../../types';

type RequestState = 'initial' | 'sending' | 'waiting' | 'verifying' | 'approved' | 'expired';

export default function AccessRequestScreen() {
  const { patientId, requestId } = useLocalSearchParams();
  const router = useRouter();
  const { doctor } = useAuthStore();
  
  const [requestState, setRequestState] = useState<RequestState>('initial');
  const [activeRequest, setActiveRequest] = useState<AccessRequest | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [errorMsg, setErrorMsg] = useState('');
  
  const appState = useRef(AppState.currentState);

  // Resume / AppState recovery
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (activeRequest) {
          refreshRequestState(activeRequest.id);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [activeRequest]);

  // Realtime subscription
  useEffect(() => {
    if (!activeRequest || (requestState !== 'waiting' && requestState !== 'sending')) return;
    
    const unsubscribe = DoctorService.subscribeToRequest(activeRequest.id, (newStatus: AccessRequestStatus) => {
      if (newStatus === 'approved') setRequestState('approved');
      if (newStatus === 'expired') setRequestState('expired');
    });

    return () => unsubscribe();
  }, [activeRequest, requestState]);

  // Countdown timer for OTP - visual only
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (requestState === 'waiting' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleClientTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [requestState, timeLeft]);

  const refreshRequestState = async (id: string) => {
    try {
      const req = await DoctorService.getRequest(id);
      if (req.status !== 'pending') {
        setRequestState(req.status);
      }
    } catch (e) {
      console.error('Failed to refresh request state', e);
    }
  };

  const handleClientTimeout = async () => {
    if (!doctor || !patientId || !activeRequest) return;
    
    // Do not blindly set expired. Verify with backend.
    try {
      const req = await DoctorService.getRequest(activeRequest.id);
      if (req.status === 'pending') {
        // Force backend expiration
        await DoctorService.logExpiredRequest(patientId as string, doctor.id, activeRequest.id);
        setRequestState('expired');
      } else {
        setRequestState(req.status);
      }
    } catch (e) {
      // Fallback
      setRequestState('expired');
    }
  };

  const handleRequestAccess = async () => {
    if (!doctor || !patientId) return;
    setRequestState('sending');
    setErrorMsg('');
    try {
      const req = await DoctorService.requestAccess(patientId as string, doctor.id);
      setActiveRequest(req);
      
      // Calculate remaining visual time based on created_at
      const created = new Date(req.created_at).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, 60 - Math.floor((now - created) / 1000));
      setTimeLeft(diff);
      
      setRequestState('waiting');
    } catch (e: any) {
      setErrorMsg('Failed to send request. Try again.');
      setRequestState('initial');
    }
  };

  const handleVerifyOTP = async () => {
    if (!doctor || !activeRequest || !otpInput) return;
    setRequestState('verifying');
    setErrorMsg('');
    
    try {
      const isValid = await DoctorService.verifyOTP(activeRequest.id, otpInput, doctor.id, patientId as string);
      if (isValid) {
        import('expo-haptics').then(Haptics => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        setRequestState('approved');
      }
    } catch (e: any) {
      setErrorMsg('Invalid or expired code.');
      await refreshRequestState(activeRequest.id);
      if (requestState !== 'expired' && requestState !== 'approved') {
        setRequestState('waiting');
        import('expo-haptics').then(Haptics => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      }
    }
  };

  const handleEmergencyOverride = () => {
    router.push(`/(doctor)/emergency-confirm?patientId=${patientId}`);
  };

  const handleViewData = () => {
    router.replace(`/(doctor)/medical-data?patientId=${patientId}`);
  };

  const resetFlow = () => {
    setRequestState('initial');
    setOtpInput('');
    setErrorMsg('');
    setTimeLeft(60);
  };

  const formatTime = (seconds: number) => {
    return `00:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          <Text style={styles.patientIdText}>Patient: {patientId}</Text>
          
          {requestState === 'initial' && (
            <Animated.View entering={FadeInDown.duration(400).springify()} exiting={FadeOutUp.duration(300)} style={styles.stateContainer}>
              <View style={styles.iconCircle}>
                <ShieldAlert color={Colors.primary} size={48} />
              </View>
              <Text style={styles.title}>Access Required</Text>
              <Text style={styles.subtitle}>
                You must request authorization to view this patient's full medical profile.
              </Text>
              <Button 
                title="Request Access" 
                onPress={handleRequestAccess} 
                icon={<Send size={20} color={Colors.white} />}
                style={styles.actionBtn} 
              />
            </Animated.View>
          )}

          {requestState === 'sending' && (
            <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.stateContainer}>
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: Spacing.xl }} />
              <Text style={styles.title}>Sending Request...</Text>
            </Animated.View>
          )}

          {requestState === 'waiting' && (
            <Animated.View entering={FadeInDown.duration(400).springify()} exiting={FadeOutUp.duration(300)} style={styles.stateContainer}>
              <View style={styles.timerCircle}>
                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
              </View>
              <View style={styles.progressBarContainer}>
                 <Animated.View style={[styles.progressBarFill, { width: `${(timeLeft / 60) * 100}%` }]} />
              </View>
              <Text style={styles.title}>Enter One-Time Code</Text>
              <Text style={styles.subtitle}>
                An email has been sent to the patient. Enter the 5-digit code to proceed.
              </Text>
              
              <Input
                placeholder="XXXXX"
                value={otpInput}
                onChangeText={setOtpInput}
                keyboardType="number-pad"
                maxLength={5}
                autoFocus
                style={styles.otpInput}
              />
              
              {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
              
              <Button 
                title="Verify Code" 
                onPress={handleVerifyOTP} 
                disabled={otpInput.length < 5}
                style={styles.actionBtn} 
              />

              <View style={[styles.emergencySection, { marginTop: Spacing.xl }]}>
                <Text style={styles.emergencyLabel}>Patient Unresponsive?</Text>
                <Button 
                  title="Emergency Override" 
                  onPress={handleEmergencyOverride} 
                  variant="ghost"
                  textStyle={{ color: Colors.error }}
                  style={{ width: '100%' }}
                />
              </View>
            </Animated.View>
          )}

          {requestState === 'verifying' && (
            <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.stateContainer}>
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: Spacing.xl }} />
              <Text style={styles.title}>Verifying...</Text>
            </Animated.View>
          )}

          {requestState === 'approved' && (
            <Animated.View entering={FadeInDown.duration(400).springify()} exiting={FadeOutUp.duration(300)} style={styles.stateContainer}>
              <View style={[styles.iconCircle, { backgroundColor: Colors.successSurface }]}>
                <ShieldCheck color={Colors.success} size={64} />
              </View>
              <Text style={[styles.title, { color: Colors.success }]}>Access Approved</Text>
              <Text style={styles.subtitle}>
                You now have authorized access to this patient's medical records.
              </Text>
              <Button 
                title="View Medical File" 
                onPress={handleViewData}
                style={styles.actionBtn} 
              />
            </Animated.View>
          )}

          {requestState === 'expired' && (
            <Animated.View entering={FadeInDown.duration(400).springify()} exiting={FadeOutUp.duration(300)} style={styles.stateContainer}>
              <View style={[styles.iconCircle, { backgroundColor: Colors.errorSurface }]}>
                <XCircle color={Colors.error} size={64} />
              </View>
              <Text style={[styles.title, { color: Colors.error }]}>Request Expired</Text>
              <Text style={styles.subtitle}>
                The authorization request has timed out. Normal consent could not be verified.
              </Text>
              
              <Button 
                title="Request Again" 
                onPress={resetFlow} 
                variant="outline"
                style={styles.actionBtn} 
              />

              <View style={styles.emergencySection}>
                <Text style={styles.emergencyLabel}>Patient Unresponsive?</Text>
                <Button 
                  title="Emergency Override" 
                  onPress={handleEmergencyOverride} 
                  variant="danger"
                  style={styles.actionBtn} 
                />
              </View>
            </Animated.View>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
    justifyContent: 'flex-start',
  },
  patientIdText: {
    ...Typography.smallMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    textTransform: 'uppercase',
  },
  stateContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  timerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  timerText: {
    ...Typography.h2,
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  progressBarContainer: {
    width: 200,
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  otpInput: {
    width: '100%',
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: Spacing.md,
  },
  actionBtn: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.smallMedium,
    color: Colors.error,
    marginBottom: Spacing.md,
  },
  emergencySection: {
    width: '100%',
    marginTop: Spacing.xxxl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  emergencyLabel: {
    ...Typography.smallMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  }
});
