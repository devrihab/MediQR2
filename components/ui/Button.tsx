import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({ 
  title, 
  onPress, 
  variant = 'primary', 
  isLoading = false, 
  disabled = false,
  style,
  textStyle,
  icon
}: ButtonProps) {
  
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (disabled || isLoading) return;
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    if (disabled || isLoading) return;
    if (Platform.OS !== 'web') {
      if (variant === 'danger') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          container: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
          text: { color: Colors.text },
        };
      case 'outline':
        return {
          container: { backgroundColor: Colors.transparent, borderWidth: 1, borderColor: Colors.border },
          text: { color: Colors.text },
        };
      case 'ghost':
        return {
          container: { backgroundColor: Colors.transparent },
          text: { color: Colors.primaryLight },
        };
      case 'danger':
        return {
          container: { backgroundColor: Colors.error },
          text: { color: Colors.white },
        };
      case 'primary':
      default:
        return {
          container: { backgroundColor: Colors.primary },
          text: { color: Colors.white },
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <Animated.View style={[animatedStyle, style, (disabled || isLoading) && styles.disabled]}>
      <Pressable
        style={[styles.container, variantStyles.container]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={variantStyles.text.color} />
        ) : (
          <>
            {icon && <Animated.View>{icon}</Animated.View>}
            <Text style={[styles.text, variantStyles.text, textStyle, icon ? { marginLeft: Spacing.sm } : null]}>
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 52,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  text: {
    ...Typography.bodyMedium,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
