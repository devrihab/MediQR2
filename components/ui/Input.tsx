import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, onFocus, onBlur, style, containerStyle, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View 
        style={[
          styles.inputContainer, 
          props.multiline && { height: 'auto', minHeight: 100, paddingVertical: Spacing.sm },
          isFocused && styles.inputFocused,
          error ? styles.inputError : null
        ]}
      >
        <TextInput
          style={[styles.input, props.multiline && { textAlignVertical: 'top' }, style]}
          placeholderTextColor={Colors.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    ...Typography.smallMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    minHeight: 52, // Changed from fixed height
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  inputFocused: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.surface,
  },
  inputError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorSurface,
  },
  input: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  errorText: {
    ...Typography.metadata,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
});
