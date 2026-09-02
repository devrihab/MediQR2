import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/Theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'elevated' | 'outlined' | 'filled';
}

export function Card({ children, style, variant = 'outlined' }: CardProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case 'elevated':
        return [styles.card, styles.elevated];
      case 'filled':
        return [styles.card, styles.filled];
      case 'outlined':
      default:
        return [styles.card, styles.outlined];
    }
  };

  return <View style={[getVariantStyle(), style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  elevated: {
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filled: {
    backgroundColor: Colors.surface,
  },
});
