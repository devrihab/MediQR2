import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';

export default function Index() {
  const { role, patient, doctor } = useAuthStore();

  if (role === 'patient' && patient) {
    return <Redirect href="/(patient)/dashboard" />;
  }

  if (role === 'doctor' && doctor) {
    return <Redirect href="/(doctor)/dashboard" />;
  }

  return <Redirect href="/(auth)/role-select" />;
}
