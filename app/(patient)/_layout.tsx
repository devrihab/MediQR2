import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors } from '../../constants/Theme';

export default function PatientLayout() {
  const { role, patient } = useAuthStore();

  if (role !== 'patient' || !patient) {
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
      <Stack.Screen name="setup" options={{ title: 'Setup Data' }} />
      <Stack.Screen name="history" options={{ title: 'Access History', headerBackTitle: 'Back' }} />
      <Stack.Screen name="edit-data" options={{ title: 'Update Identity', headerBackTitle: 'Back' }} />
    </Stack>
  );
}
