import { Platform, StyleSheet } from 'react-native';

export const Colors = {
  // Primary (Deep Healthcare Blue/Indigo)
  primary: '#1A365D', // Dark Blue
  primaryLight: '#2B6CB0',
  primarySurface: '#EBF8FF',

  // Neutrals
  background: '#FFFFFF',
  surface: '#F7FAFC',
  surfaceHover: '#EDF2F7',
  
  // Text
  text: '#1A202C', // Almost black
  textSecondary: '#4A5568', // Dark gray
  textMuted: '#A0AEC0', // Light gray
  
  // Borders
  border: '#E2E8F0',
  borderHover: '#CBD5E0',
  
  // Status (Restrained)
  error: '#E53E3E',
  errorSurface: '#FFF5F5',
  success: '#38A169',
  successSurface: '#F0FFF4',
  warning: '#D69E2E',
  warningSurface: '#FFFFF0',
  
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

export const Shadows = StyleSheet.create({
  sm: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  }
});

export const Typography = StyleSheet.create({
  display: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 48,
    letterSpacing: -1,
    color: Colors.text,
  },
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.8,
    color: Colors.text,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    letterSpacing: -0.5,
    color: Colors.text,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.4,
    color: Colors.text,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.textSecondary,
  },
  bodyLarge: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 28,
    color: Colors.text,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: Colors.text,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: Colors.text,
  },
  small: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  smallMedium: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  metadata: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: Colors.textMuted,
  },
});

export const AnimationParams = {
  fast: 200,
  normal: 300,
  slow: 500,
};
