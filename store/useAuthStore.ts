import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Role, Patient, Doctor } from '../types';

import { Platform } from 'react-native';

// Custom storage wrapper for Expo SecureStore with Web/SSR fallback
const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(name);
      }
      return null;
    }
    return await SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(name, value);
      }
      return;
    }
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(name);
      }
      return;
    }
    await SecureStore.deleteItemAsync(name);
  },
};

interface AuthState {
  role: Role | null;
  patient: Patient | null;
  doctor: Doctor | null;
  setRole: (role: Role | null) => void;
  loginPatient: (patient: Patient) => void;
  loginDoctor: (doctor: Doctor) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      patient: null,
      doctor: null,
      setRole: (role) => set({ role }),
      loginPatient: (patient) => set({ patient, role: 'patient' }),
      loginDoctor: (doctor) => set({ doctor, role: 'doctor' }),
      logout: () => set({ role: null, patient: null, doctor: null }),
    }),
    {
      name: 'mediqr-session',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
