import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, TouchableWithoutFeedback, Platform } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/Theme';
import { ChevronDown, Check } from 'lucide-react-native';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  error?: string;
}

export function Select({ label, value, options, onSelect, placeholder = 'Select...', error }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity 
        style={[
          styles.selectContainer,
          isOpen && styles.selectFocused,
          error ? styles.selectError : null
        ]}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.valueText, !selectedOption && styles.placeholderText]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{label || 'Select Option'}</Text>
                  <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
                
                <FlatList
                  data={options}
                  keyExtractor={item => item.value}
                  renderItem={({ item }) => {
                    const isSelected = item.value === value;
                    return (
                      <TouchableOpacity 
                        style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                        onPress={() => {
                          onSelect(item.value);
                          setIsOpen(false);
                        }}
                      >
                        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                          {item.label}
                        </Text>
                        {isSelected && <Check size={20} color={Colors.primary} />}
                      </TouchableOpacity>
                    );
                  }}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                  contentContainerStyle={styles.listContainer}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  selectContainer: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    height: 52,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectFocused: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.surface,
  },
  selectError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorSurface,
  },
  valueText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
  },
  placeholderText: {
    color: Colors.textMuted,
  },
  errorText: {
    ...Typography.metadata,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  closeBtnText: {
    ...Typography.bodyMedium,
    color: Colors.primary,
  },
  listContainer: {
    padding: Spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  optionRowSelected: {
    backgroundColor: Colors.primarySurface,
  },
  optionText: {
    ...Typography.body,
    color: Colors.text,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
