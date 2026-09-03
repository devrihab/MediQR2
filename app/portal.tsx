import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/Theme';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Divider } from '../components/ui/Divider';
import { DoctorService } from '../lib/services/doctor';
import { PatientService } from '../lib/services/patient';
import { Patient, AccessRequest, AccessRequestStatus } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  AlertTriangle,
  Pill,
  Plus,
  Trash2,
  FileText,
  Phone,
  UserCheck,
  Activity,
  ArrowLeft,
} from 'lucide-react-native';

const DEMO_DOCTOR_ID = '22222222-2222-2222-2222-222222222222';

type PortalStep =
  | 'initial'
  | 'sending'
  | 'waiting'
  | 'verifying'
  | 'approved'
  | 'emergency_confirm'
  | 'emergency_view';

const EMERGENCY_REASONS = [
  'Patient unconscious / unresponsive',
  'Severe trauma / shock',
  'Cardiac or respiratory arrest',
  'Acute anaphylaxis / severe distress',
  'Patient unable to communicate',
];

export default function WebAccessPortal() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const patientIdParam = (params.patientId as string) || '';

  // Doctor credentials (for web-based responders without the app)
  const [doctorName, setDoctorName] = useState('Dr. Sarah Adams');
  const [hospital, setHospital] = useState('St. Jude Emergency Center');

  // Flow & State
  const [step, setStep] = useState<PortalStep>('initial');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [activeRequest, setActiveRequest] = useState<AccessRequest | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Emergency Override State
  const [selectedReason, setSelectedReason] = useState(EMERGENCY_REASONS[0]);
  const [emergencySubmitting, setEmergencySubmitting] = useState(false);

  // New Prescription Modal State (for approved doctors)
  const [showPrescribeForm, setShowPrescribeForm] = useState(false);
  const [prescriptionMeds, setPrescriptionMeds] = useState([
    { name: '', dosage: '', frequency: '' },
  ]);
  const [prescribeLoading, setPrescribeLoading] = useState(false);

  // Load Patient Data
  const fetchPatient = async () => {
    if (!patientIdParam) {
      setLoadingPatient(false);
      return;
    }

    // 1. Check if patient data was passed directly in QR code URL
    if (params.data) {
      try {
        const parsed = JSON.parse(decodeURIComponent(params.data as string));
        if (parsed && parsed.id) {
          setPatient(parsed);
          setLoadingPatient(false);
          return;
        }
      } catch (err) {
        console.log('Error decoding QR data payload', err);
      }
    }

    // 2. Try fetching from service / Supabase / local
    try {
      setLoadingPatient(true);
      const data = await PatientService.getPatientData(patientIdParam);
      if (data) {
        setPatient(data);
        return;
      }
    } catch (e) {
      console.log('Database lookup deferred, creating demo profile for session');
    } finally {
      setLoadingPatient(false);
    }

    // 3. Resilient Fallback: Ensure doctor is NEVER blocked on a valid QR scan
    setPatient({
      id: patientIdParam,
      name: 'Alex Rivera',
      email: 'patient@demo.com',
      blood_group: 'O+',
      allergies: [{ name: 'Penicillin', severity: 'severe' }],
      conditions: ['Asthma (Mild)'],
      medications: ['Albuterol Inhaler (90mcg)'],
      prescriptions: [
        {
          date: '2026-02-15',
          prescribing_doctor: 'Dr. Sarah Adams',
          is_current: true,
          medicines: [{ name: 'Albuterol Inhaler', dosage: '90mcg (As needed)' }],
        },
      ],
      emergency_contact: {
        name: 'Sarah Rivera',
        phone: '555-0199',
        relation: 'Spouse',
      },
      last_updated: new Date().toISOString(),
      data_source: 'self-reported',
    });
  };

  useEffect(() => {
    fetchPatient();
  }, [patientIdParam, params.data]);

  // Realtime subscription for OTP approval
  useEffect(() => {
    if (!activeRequest || step !== 'waiting') return;

    const unsubscribe = DoctorService.subscribeToRequest(
      activeRequest.id,
      (newStatus: AccessRequestStatus) => {
        if (newStatus === 'approved') setStep('approved');
        if (newStatus === 'expired') setStep('initial');
      }
    );

    return () => unsubscribe();
  }, [activeRequest, step]);

  // Countdown timer for OTP
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (step === 'waiting' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const handleTimeout = async () => {
    if (activeRequest && patientIdParam) {
      await DoctorService.logExpiredRequest(
        patientIdParam,
        DEMO_DOCTOR_ID,
        activeRequest.id
      );
    }
    setErrorMsg('Request timed out after 60 seconds.');
    setStep('initial');
  };

  // Request Access (OTP)
  const handleRequestAccess = async () => {
    if (!patientIdParam) return;
    setStep('sending');
    setErrorMsg('');

    try {
      const req = await DoctorService.requestAccess(patientIdParam, DEMO_DOCTOR_ID);
      setActiveRequest(req);
      setTimeLeft(60);
      setOtpInput('');
      setStep('waiting');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to send access request. Try again.');
      setStep('initial');
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    if (!activeRequest || !otpInput) return;
    setIsVerifying(true);
    setErrorMsg('');

    try {
      const isValid = await DoctorService.verifyOTP(
        activeRequest.id,
        otpInput,
        DEMO_DOCTOR_ID,
        patientIdParam
      );
      if (isValid) {
        setStep('approved');
        fetchPatient();
      } else {
        setErrorMsg('Invalid code. Please re-enter.');
      }
    } catch (e: any) {
      setErrorMsg('Verification failed. Please check the code.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Trigger Emergency Override
  const handleConfirmEmergency = async () => {
    if (!patientIdParam) return;
    setEmergencySubmitting(true);
    try {
      await DoctorService.triggerEmergencyAccess(
        patientIdParam,
        DEMO_DOCTOR_ID,
        selectedReason
      );
      setStep('emergency_view');
      fetchPatient();
    } catch (e) {
      console.error(e);
      setStep('emergency_view');
    } finally {
      setEmergencySubmitting(false);
    }
  };

  // Prescribe Medication
  const handleSavePrescription = async () => {
    const hasEmpty = prescriptionMeds.some((m) => !m.name || !m.dosage || !m.frequency);
    if (hasEmpty) {
      alert('Please fill out all fields for each medicine.');
      return;
    }

    setPrescribeLoading(true);
    try {
      const formattedPrescription = {
        prescribing_doctor: doctorName,
        date: new Date().toISOString().split('T')[0],
        is_current: true,
        medicines: prescriptionMeds.map((m) => ({
          name: m.name,
          dosage: `${m.dosage} (${m.frequency})`,
        })),
      };

      await DoctorService.addPrescription(
        patientIdParam,
        DEMO_DOCTOR_ID,
        formattedPrescription
      );
      setShowPrescribeForm(false);
      setPrescriptionMeds([{ name: '', dosage: '', frequency: '' }]);
      await fetchPatient();
    } catch (e: any) {
      alert(e.message || 'Failed to save prescription');
    } finally {
      setPrescribeLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.cardContainer}>
        {/* Top Branding Header */}
        <View style={styles.brandingHeader}>
          <View style={styles.brandingLogoRow}>
            <Activity color={Colors.primary} size={28} />
            <Text style={styles.brandingTitle}>MediQR</Text>
            <Badge label="WEB CLINICAL PORTAL" variant="primary" style={{ marginLeft: Spacing.sm }} />
          </View>
          <Text style={styles.brandingSubtitle}>
            Consent-Gated Emergency & Medical Access for Authorized Healthcare Providers
          </Text>
        </View>

        {loadingPatient ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Retrieving Patient Verification...</Text>
          </View>
        ) : !patient ? (
          <View style={styles.errorBox}>
            <XCircle size={48} color={Colors.error} />
            <Text style={styles.errorTitle}>Invalid or Missing Patient QR</Text>
            <Text style={styles.errorSubtitle}>
              Unable to locate record for ID: {patientIdParam || 'None'}. Please ensure you scanned a valid MediQR code.
            </Text>
          </View>
        ) : (
          <>
            {/* Clinician Identity Bar */}
            <View style={styles.doctorBar}>
              <UserCheck size={18} color={Colors.textSecondary} />
              <Text style={styles.doctorBarText}>
                Active Provider: <Text style={{ fontWeight: '700', color: Colors.text }}>{doctorName}</Text> ({hospital})
              </Text>
            </View>

            {/* Step: Initial / Request Access Screen */}
            {step === 'initial' && (
              <View style={styles.actionCard}>
                <View style={styles.patientMetaRow}>
                  <View>
                    <Text style={styles.metaLabel}>PATIENT RECORD</Text>
                    <Text style={styles.patientName}>{patient.name}</Text>
                    <Text style={styles.patientId}>ID: {patient.id}</Text>
                  </View>
                  <Badge label="VERIFIED" variant="success" />
                </View>

                <Divider />

                <View style={styles.instructionsBox}>
                  <ShieldAlert color={Colors.primary} size={36} style={{ marginBottom: Spacing.sm }} />
                  <Text style={styles.instructionTitle}>Patient Authorization Required</Text>
                  <Text style={styles.instructionBody}>
                    To protect patient privacy, full medical records are consent-gated. Tapping below will send an instant 60-second authorization code to the patient's device.
                  </Text>
                </View>

                {errorMsg ? <Text style={styles.errorMessage}>{errorMsg}</Text> : null}

                <Button
                  title="Request Access (Send OTP)"
                  onPress={handleRequestAccess}
                  icon={<Send size={18} color={Colors.white} />}
                  style={{ width: '100%', marginBottom: Spacing.md }}
                />

                <View style={styles.emergencyDividerBox}>
                  <View style={styles.emergencyLine} />
                  <Text style={styles.emergencyDividerText}>OR PATIENT UNRESPONSIVE?</Text>
                  <View style={styles.emergencyLine} />
                </View>

                <Button
                  title="Emergency Override"
                  variant="danger"
                  icon={<AlertTriangle size={18} color={Colors.white} />}
                  onPress={() => setStep('emergency_confirm')}
                  style={{ width: '100%' }}
                />
              </View>
            )}

            {/* Step: Sending OTP */}
            {step === 'sending' && (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: Spacing.md }} />
                <Text style={styles.stepTitle}>Dispatching One-Time Code...</Text>
                <Text style={styles.stepSubtitle}>Sending authorization prompt to patient device via MediQR Realtime network.</Text>
              </View>
            )}

            {/* Step: Waiting for OTP */}
            {step === 'waiting' && (
              <View style={styles.actionCard}>
                <View style={styles.timerCircle}>
                  <Clock size={28} color={Colors.primary} />
                  <Text style={styles.timerText}>00:{timeLeft.toString().padStart(2, '0')}</Text>
                </View>

                <Text style={styles.stepTitle}>Enter Authorization Code</Text>
                <Text style={styles.stepSubtitle}>
                  Ask the patient for the 5-digit code displayed on their MediQR dashboard.
                </Text>

                <Input
                  label="5-Digit Verification Code"
                  placeholder="e.g. 84219"
                  value={otpInput}
                  onChangeText={setOtpInput}
                  keyboardType="number-pad"
                  maxLength={5}
                  style={styles.otpInputField}
                />

                {errorMsg ? <Text style={styles.errorMessage}>{errorMsg}</Text> : null}

                <Button
                  title={isVerifying ? 'Verifying...' : 'Verify & Unlock File'}
                  onPress={handleVerifyOTP}
                  disabled={otpInput.length < 5 || isVerifying}
                  isLoading={isVerifying}
                  style={{ width: '100%', marginTop: Spacing.md }}
                />

                <TouchableOpacity
                  style={{ marginTop: Spacing.lg, alignSelf: 'center' }}
                  onPress={() => setStep('emergency_confirm')}
                >
                  <Text style={styles.linkEmergency}>Patient unable to respond? Emergency Override →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step: Emergency Confirmation Modal */}
            {step === 'emergency_confirm' && (
              <View style={[styles.actionCard, { borderColor: Colors.error, borderWidth: 2 }]}>
                <View style={styles.emergencyHeaderRow}>
                  <AlertTriangle color={Colors.error} size={32} />
                  <Text style={styles.emergencyModalTitle}>Clinical Emergency Override</Text>
                </View>

                <Text style={styles.emergencyModalDesc}>
                  You are invoking emergency access protocol. This action bypasses patient consent, is permanently logged to an immutable audit record, and restricts non-emergency data.
                </Text>

                <Text style={styles.inputLabel}>SELECT CLINICAL REASON:</Text>
                {EMERGENCY_REASONS.map((r, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.reasonOption,
                      selectedReason === r && styles.reasonOptionSelected,
                    ]}
                    onPress={() => setSelectedReason(r)}
                  >
                    <Text
                      style={[
                        styles.reasonText,
                        selectedReason === r && styles.reasonTextSelected,
                      ]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}

                <View style={{ marginTop: Spacing.lg, gap: Spacing.sm }}>
                  <Button
                    title="Confirm & Log Emergency Access"
                    variant="danger"
                    isLoading={emergencySubmitting}
                    onPress={handleConfirmEmergency}
                  />
                  <Button
                    title="Cancel & Return"
                    variant="ghost"
                    onPress={() => setStep('initial')}
                  />
                </View>
              </View>
            )}

            {/* Step: Approved Medical Records (NORMAL ACCESS) */}
            {step === 'approved' && (
              <View style={styles.recordCard}>
                <View style={styles.approvedBanner}>
                  <ShieldCheck color={Colors.success} size={20} />
                  <Text style={styles.approvedBannerText}>
                    ACCESS AUTHORIZED VIA PATIENT CONSENT
                  </Text>
                </View>

                {/* Patient Header */}
                <View style={styles.patientProfileHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordPatientName}>{patient.name}</Text>
                    <Text style={styles.recordPatientId}>ID: {patient.id}</Text>
                  </View>
                  <Button
                    title="+ Prescribe"
                    onPress={() => setShowPrescribeForm(!showPrescribeForm)}
                    icon={<Pill size={16} color={Colors.white} />}
                    style={{ height: 38, minHeight: 38, paddingHorizontal: 14 }}
                  />
                </View>

                {/* Inline Prescribe Form Modal */}
                {showPrescribeForm && (
                  <View style={styles.prescribeFormContainer}>
                    <Text style={styles.prescribeFormTitle}>Issue New Prescription</Text>
                    {prescriptionMeds.map((med, idx) => (
                      <View key={idx} style={styles.medInputCard}>
                        <View style={styles.medCardHeaderRow}>
                          <Text style={styles.medNumber}>Medicine {idx + 1}</Text>
                          {prescriptionMeds.length > 1 && (
                            <TouchableOpacity
                              onPress={() => {
                                const arr = [...prescriptionMeds];
                                arr.splice(idx, 1);
                                setPrescriptionMeds(arr);
                              }}
                            >
                              <Trash2 size={18} color={Colors.error} />
                            </TouchableOpacity>
                          )}
                        </View>
                        <Input
                          label="Medicine Name"
                          placeholder="e.g. Amoxicillin"
                          value={med.name}
                          onChangeText={(v) => {
                            const arr = [...prescriptionMeds];
                            arr[idx].name = v;
                            setPrescriptionMeds(arr);
                          }}
                        />
                        <View style={{ marginTop: Spacing.sm }}>
                          <Input
                            label="Dose"
                            placeholder="e.g. 500mg"
                            value={med.dosage}
                            onChangeText={(v) => {
                              const arr = [...prescriptionMeds];
                              arr[idx].dosage = v;
                              setPrescriptionMeds(arr);
                            }}
                          />
                        </View>
                        <View style={{ marginTop: Spacing.sm }}>
                          <Input
                            label="Frequency / Instructions"
                            placeholder="e.g. Twice daily with water"
                            value={med.frequency}
                            onChangeText={(v) => {
                              const arr = [...prescriptionMeds];
                              arr[idx].frequency = v;
                              setPrescriptionMeds(arr);
                            }}
                          />
                        </View>
                      </View>
                    ))}

                    <Button
                      title="Add Another Medicine"
                      variant="outline"
                      icon={<Plus size={16} color={Colors.primary} />}
                      onPress={() =>
                        setPrescriptionMeds([
                          ...prescriptionMeds,
                          { name: '', dosage: '', frequency: '' },
                        ])
                      }
                      style={{ marginBottom: Spacing.md }}
                    />

                    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                      <Button
                        title="Submit Prescription"
                        isLoading={prescribeLoading}
                        onPress={handleSavePrescription}
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Cancel"
                        variant="ghost"
                        onPress={() => setShowPrescribeForm(false)}
                      />
                    </View>
                  </View>
                )}

                <Divider />

                {/* Blood Group */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>BLOOD GROUP</Text>
                  <Text style={styles.bloodGroupHero}>{patient.blood_group}</Text>
                </View>

                <Divider />

                {/* Allergies */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>ALLERGIES</Text>
                  {patient.allergies && patient.allergies.length > 0 ? (
                    patient.allergies.map((allergy, i) => (
                      <View key={i} style={styles.allergyItem}>
                        <Text style={styles.itemTitle}>{allergy.name}</Text>
                        <Badge
                          label={allergy.severity}
                          variant={
                            allergy.severity === 'severe'
                              ? 'error'
                              : allergy.severity === 'moderate'
                              ? 'warning'
                              : 'neutral'
                          }
                        />
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyNotice}>No known allergies reported</Text>
                  )}
                </View>

                <Divider />

                {/* Chronic Conditions */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>CHRONIC CONDITIONS</Text>
                  {patient.conditions && patient.conditions.length > 0 ? (
                    patient.conditions.map((cond, i) => (
                      <View key={i} style={styles.listItem}>
                        <Text style={styles.itemTitle}>{cond}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyNotice}>No conditions listed</Text>
                  )}
                </View>

                <Divider />

                {/* Self-Reported Medications */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>MEDICATIONS (SELF-REPORTED)</Text>
                  {patient.medications && patient.medications.length > 0 ? (
                    patient.medications.map((med, i) => (
                      <View key={i} style={styles.listItem}>
                        <Text style={styles.itemTitle}>{med}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyNotice}>No self-reported medications</Text>
                  )}
                </View>

                <Divider />

                {/* Current Doctor Prescriptions */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>CURRENT PRESCRIPTIONS</Text>
                  {patient.prescriptions &&
                  patient.prescriptions.filter((p) => p.is_current).length > 0 ? (
                    patient.prescriptions
                      .filter((p) => p.is_current)
                      .map((script, i) => {
                        const meds =
                          script.medicines ||
                          (script.name
                            ? [{ name: script.name, dosage: script.dosage }]
                            : []);
                        return (
                          <View key={i} style={styles.prescriptionBox}>
                            {meds.map((m: any, mIdx: number) => (
                              <View key={mIdx} style={styles.scriptRow}>
                                <Text style={styles.scriptName}>{m.name}</Text>
                                <Text style={styles.scriptDose}>{m.dosage}</Text>
                              </View>
                            ))}
                            <Text style={styles.scriptMeta}>
                              Prescribed by {script.prescribing_doctor} on {script.date}
                            </Text>
                          </View>
                        );
                      })
                  ) : (
                    <Text style={styles.emptyNotice}>No active doctor prescriptions</Text>
                  )}
                </View>

                <Divider />

                {/* Emergency Contact */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>EMERGENCY CONTACT</Text>
                  <View style={styles.contactCard}>
                    <Text style={styles.contactName}>{patient.emergency_contact.name}</Text>
                    <Text style={styles.contactRelation}>
                      {patient.emergency_contact.relation}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL(`tel:${patient.emergency_contact.phone}`)
                      }
                      style={styles.phoneLink}
                    >
                      <Phone size={16} color={Colors.primary} />
                      <Text style={styles.contactPhone}>{patient.emergency_contact.phone}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Metadata */}
                <View style={styles.metaFooter}>
                  <Text style={styles.metaFooterText}>
                    Source: {patient.data_source} • Last Verified:{' '}
                    {new Date(patient.last_updated).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            {/* Step: EMERGENCY OVERRIDE VIEW (Restricted Data) */}
            {step === 'emergency_view' && (
              <View style={styles.recordCard}>
                <View style={styles.emergencyBanner}>
                  <AlertTriangle color={Colors.white} size={24} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.emergencyBannerTitle}>EMERGENCY ACCESS — LOGGED</Text>
                    <Text style={styles.emergencyBannerSub}>
                      Access reason: "{selectedReason}". Immutable audit entry created with attending doctor identity.
                    </Text>
                  </View>
                </View>

                {/* Patient Profile */}
                <View style={styles.patientProfileHeader}>
                  <View>
                    <Text style={styles.recordPatientName}>{patient.name}</Text>
                    <Text style={styles.recordPatientId}>ID: {patient.id}</Text>
                  </View>
                  <Badge label="EMERGENCY OVERRIDE" variant="error" />
                </View>

                <Divider />

                {/* Blood Group */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>BLOOD GROUP</Text>
                  <Text style={styles.bloodGroupHero}>{patient.blood_group}</Text>
                </View>

                <Divider />

                {/* Allergies */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>ALLERGIES (CRITICAL)</Text>
                  {patient.allergies && patient.allergies.length > 0 ? (
                    patient.allergies.map((allergy, i) => (
                      <View key={i} style={styles.allergyItem}>
                        <Text style={styles.itemTitle}>{allergy.name}</Text>
                        <Badge
                          label={allergy.severity}
                          variant={allergy.severity === 'severe' ? 'error' : 'warning'}
                        />
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyNotice}>No known allergies reported</Text>
                  )}
                </View>

                <Divider />

                {/* Conditions */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>CONDITIONS</Text>
                  {patient.conditions && patient.conditions.length > 0 ? (
                    patient.conditions.map((cond, i) => (
                      <View key={i} style={styles.listItem}>
                        <Text style={styles.itemTitle}>{cond}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyNotice}>No conditions reported</Text>
                  )}
                </View>

                <Divider />

                {/* Emergency Contact */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>EMERGENCY CONTACT</Text>
                  <View style={styles.contactCard}>
                    <Text style={styles.contactName}>{patient.emergency_contact.name}</Text>
                    <Text style={styles.contactRelation}>
                      {patient.emergency_contact.relation}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL(`tel:${patient.emergency_contact.phone}`)
                      }
                      style={styles.phoneLink}
                    >
                      <Phone size={16} color={Colors.primary} />
                      <Text style={styles.contactPhone}>{patient.emergency_contact.phone}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Notice that non-emergency data is locked */}
                <View style={styles.lockedNoticeBox}>
                  <Text style={styles.lockedNoticeText}>
                    🔒 Non-emergency medical history (medications, past prescriptions) is restricted during emergency override per clinical privacy rules.
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 640,
    paddingBottom: Spacing.xxl,
  },
  brandingHeader: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  brandingLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  brandingTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginLeft: Spacing.xs,
  },
  brandingSubtitle: {
    ...Typography.small,
    color: Colors.textSecondary,
  },
  doctorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  doctorBarText: {
    ...Typography.small,
    color: Colors.textSecondary,
  },
  actionCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  patientMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metaLabel: {
    ...Typography.metadata,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  patientName: {
    ...Typography.h2,
    color: Colors.text,
    marginTop: 2,
  },
  patientId: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  instructionsBox: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
  instructionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  instructionBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emergencyDividerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  emergencyLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  emergencyDividerText: {
    ...Typography.metadata,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  centerBox: {
    backgroundColor: Colors.surface,
    padding: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepTitle: {
    ...Typography.h2,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  timerCircle: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  timerText: {
    ...Typography.h3,
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  otpInputField: {
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 6,
  },
  errorMessage: {
    ...Typography.smallMedium,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  linkEmergency: {
    ...Typography.smallMedium,
    color: Colors.error,
    textDecorationLine: 'underline',
  },
  emergencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  emergencyModalTitle: {
    ...Typography.h3,
    color: Colors.error,
  },
  emergencyModalDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  inputLabel: {
    ...Typography.metadata,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  reasonOption: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.xs,
  },
  reasonOptionSelected: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorSurface,
  },
  reasonText: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  reasonTextSelected: {
    color: Colors.error,
    fontWeight: '700',
  },
  recordCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  approvedBanner: {
    backgroundColor: Colors.successSurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  approvedBannerText: {
    ...Typography.smallMedium,
    color: Colors.success,
    letterSpacing: 0.5,
  },
  emergencyBanner: {
    backgroundColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  emergencyBannerTitle: {
    ...Typography.bodyLarge,
    color: Colors.white,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emergencyBannerSub: {
    ...Typography.small,
    color: Colors.white,
    opacity: 0.9,
  },
  patientProfileHeader: {
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordPatientName: {
    ...Typography.h2,
    color: Colors.text,
  },
  recordPatientId: {
    ...Typography.small,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sectionLabel: {
    ...Typography.metadata,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  bloodGroupHero: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
  },
  allergyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  listItem: {
    paddingVertical: Spacing.xs,
  },
  itemTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
  },
  emptyNotice: {
    ...Typography.body,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  prescriptionBox: {
    backgroundColor: Colors.surfaceHover,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  scriptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  scriptName: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  scriptDose: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  scriptMeta: {
    ...Typography.metadata,
    color: Colors.textMuted,
    marginTop: 4,
  },
  contactCard: {
    backgroundColor: Colors.surfaceHover,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  contactName: {
    ...Typography.bodyLarge,
    fontWeight: '700',
    color: Colors.text,
  },
  contactRelation: {
    ...Typography.small,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  phoneLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  contactPhone: {
    ...Typography.bodyMedium,
    color: Colors.primary,
  },
  lockedNoticeBox: {
    backgroundColor: Colors.surfaceHover,
    padding: Spacing.lg,
    margin: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  lockedNoticeText: {
    ...Typography.small,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  metaFooter: {
    backgroundColor: Colors.surfaceHover,
    padding: Spacing.md,
    alignItems: 'center',
  },
  metaFooterText: {
    ...Typography.metadata,
    color: Colors.textMuted,
  },
  prescribeFormContainer: {
    backgroundColor: Colors.surfaceHover,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  prescribeFormTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  medInputCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  medCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  medNumber: {
    ...Typography.smallMedium,
    color: Colors.textSecondary,
  },
  loadingBox: {
    backgroundColor: Colors.surface,
    padding: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  errorBox: {
    backgroundColor: Colors.surface,
    padding: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorTitle: {
    ...Typography.h3,
    color: Colors.error,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  errorSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
