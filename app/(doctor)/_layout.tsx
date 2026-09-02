import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/Theme';

export default function DoctorLayout() {
  const { role, doctor } = useAuthStore();

  if (role !== 'doctor' || !doctor) {
    return <Redirect href="/(auth)/role-select" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerShadowVisible: false,
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="scan" options={{ title: 'Scan QR', headerBackTitle: 'Back' }} />
      <Stack.Screen name="access-request" options={{ title: 'Request Access', headerBackTitle: 'Back' }} />
      <Stack.Screen name="emergency-confirm" options={{ title: 'Emergency Override', headerBackTitle: 'Back' }} />
      <Stack.Screen name="medical-data" options={{ title: 'Patient File', headerBackTitle: 'Back' }} />
    </Stack>
  );
}
