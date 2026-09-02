import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';

interface BadgeProps {
  label: string;
  variant?: 'neutral' | 'success' | 'warning' | 'error' | 'primary';
  style?: ViewStyle;
}

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return { container: { backgroundColor: Colors.successSurface }, text: { color: Colors.success } };
      case 'warning':
        return { container: { backgroundColor: Colors.warningSurface }, text: { color: Colors.warning } };
      case 'error':
        return { container: { backgroundColor: Colors.errorSurface }, text: { color: Colors.error } };
      case 'primary':
        return { container: { backgroundColor: Colors.primarySurface }, text: { color: Colors.primary } };
      case 'neutral':
      default:
        return { container: { backgroundColor: Colors.surfaceHover }, text: { color: Colors.textSecondary } };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <View style={[styles.container, vStyles.container, style]}>
      <Text style={[styles.text, vStyles.text]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    ...Typography.metadata,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
