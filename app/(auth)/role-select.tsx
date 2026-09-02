import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { Colors, Typography, Spacing } from '../../constants/Theme';
import { Shield, User } from 'lucide-react-native';

export default function RoleSelectScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.brandContainer}>
            <Shield color={Colors.primary} size={32} style={styles.brandIcon} />
            <Text style={styles.title}>MediQR</Text>
          </View>
          <Text style={styles.subtitle}>Your medical identity.</Text>
          <Text style={styles.subtitleMuted}>Available when it matters most.</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.prompt}>Select your role to continue</Text>
          <Button
            title="Continue as Patient"
            onPress={() => router.push('/(auth)/patient-login')}
            icon={<User color={Colors.white} size={20} />}
            style={styles.button}
          />
          <Button
            title="Continue as Provider"
            onPress={() => router.push('/(auth)/doctor-login')}
            variant="secondary"
            icon={<Shield color={Colors.text} size={20} />}
            style={styles.button}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
    paddingVertical: Spacing.xl,
  },
  header: {
    marginTop: Spacing.xl,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  brandIcon: {
    marginRight: Spacing.sm,
  },
  title: {
    ...Typography.display,
  },
  subtitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
  },
  subtitleMuted: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
  },
  content: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  prompt: {
    ...Typography.smallMedium,
    marginBottom: Spacing.sm,
  },
  button: {
    marginBottom: Spacing.xs,
  },
});
