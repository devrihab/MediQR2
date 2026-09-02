import { Link, Stack } from 'expo-router';
import { StyleSheet, View, Text } from 'react-native';
import { Typography, Spacing, Colors } from '../constants/Theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  title: {
    ...Typography.h2,
  },
  link: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  linkText: {
    ...Typography.bodyLarge,
    color: Colors.primary,
  },
});
