import { Stack } from 'expo-router';
import { Colors } from '../../constants/Theme';

export default function AuthLayout() {
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
      <Stack.Screen 
        name="role-select" 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="patient-login" 
        options={{ title: 'Patient Access', headerBackTitle: 'Back' }} 
      />
      <Stack.Screen 
        name="doctor-login" 
        options={{ title: 'Provider Access', headerBackTitle: 'Back' }} 
      />
    </Stack>
  );
}
