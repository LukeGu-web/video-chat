/**
 * Object Recognition Store - Zustand with MMKV Persistence
 * Manages object recognition records with automatic persistence
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { ObjectRecognitionRecord } from '../types/scene';
import { debugLog, debugError } from '../utils/debug';

// ============================================
// MMKV Storage Instance
// ============================================

const storage = createMMKV({
  id: 'object-recognition-storage',
  encryptionKey: 'object-recognition-encryption-key',
});

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  RECORDS: 'object-recognition-records',
} as const;

// ============================================
// Constants
// ============================================

const MAX_RECORDS = 50;

// ============================================
// Store Interface
// ============================================

interface ObjectRecognitionStoreState {
  records: ObjectRecognitionRecord[];
  maxRecords: number;
}

interface ObjectRecognitionStoreActions {
  // Load data from MMKV
  loadFromStorage: () => void;

  // Record management
  addRecord: (record: ObjectRecognitionRecord) => void;
  deleteRecord: (recordId: string) => void;
  clearAllRecords: () => void;

  // Query methods
  getRecordsByCategory: (category: string) => ObjectRecognitionRecord[];
  searchRecords: (query: string) => ObjectRecognitionRecord[];
  getStats: () => {
    totalRecords: number;
    categories: Array<{ name: string; count: number }>;
    latestRecord: ObjectRecognitionRecord | null;
  };

  // Configuration
  setMaxRecords: (max: number) => void;

  // Reset
  reset: () => void;
}

type ObjectRecognitionStore = ObjectRecognitionStoreState &
  ObjectRecognitionStoreActions;

// ============================================
// Initial State
// ============================================

const initialState: ObjectRecognitionStoreState = {
  records: [],
  maxRecords: MAX_RECORDS,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Load records from MMKV storage
 */
function loadRecordsFromStorage(): ObjectRecognitionRecord[] {
  try {
    const storedRecords = storage.getString(STORAGE_KEYS.RECORDS);
    if (storedRecords) {
      const parsed = JSON.parse(storedRecords) as ObjectRecognitionRecord[];
      // Sort by createdAt descending (newest first)
      parsed.sort((a, b) => b.createdAt - a.createdAt);
      debugLog(
        'ObjectRecognitionStore',
        `Loaded ${parsed.length} records from storage`
      );
      return parsed;
    } else {
      debugLog('ObjectRecognitionStore', 'No stored records found');
      return [];
    }
  } catch (error) {
    debugError('ObjectRecognitionStore', 'Failed to load records', error);
    return [];
  }
}

/**
 * Save records to MMKV storage
 */
function saveRecordsToStorage(records: ObjectRecognitionRecord[]): void {
  try {
    storage.set(STORAGE_KEYS.RECORDS, JSON.stringify(records));
    debugLog(
      'ObjectRecognitionStore',
      `Saved ${records.length} records to storage`
    );
  } catch (error) {
    debugError('ObjectRecognitionStore', 'Failed to save records', error);
  }
}

// ============================================
// Store Definition
// ============================================

export const useObjectRecognitionStore = create<ObjectRecognitionStore>()(
  immer((set, get) => ({
    ...initialState,

    loadFromStorage: () => {
      const records = loadRecordsFromStorage();
      set((state) => {
        state.records = records;
      });
    },

    addRecord: (record: ObjectRecognitionRecord) => {
      set((state) => {
        // Add to records (newest first)
        state.records.unshift(record);

        // Keep only maxRecords newest records
        if (state.records.length > state.maxRecords) {
          state.records = state.records.slice(0, state.maxRecords);
        }

        // Save to storage
        saveRecordsToStorage(state.records);

        debugLog('ObjectRecognitionStore', 'Added new record', {
          id: record.id,
          name: record.data.objectName,
          category: record.data.category,
          totalRecords: state.records.length,
        });
      });
    },

    deleteRecord: (recordId: string) => {
      set((state) => {
        const beforeCount = state.records.length;
        state.records = state.records.filter((r) => r.id !== recordId);
        const afterCount = state.records.length;

        if (beforeCount !== afterCount) {
          // Save to storage
          saveRecordsToStorage(state.records);
          debugLog('ObjectRecognitionStore', `Deleted record: ${recordId}`);
        }
      });
    },

    clearAllRecords: () => {
      set((state) => {
        state.records = [];
      });
      storage.remove(STORAGE_KEYS.RECORDS);
      debugLog('ObjectRecognitionStore', 'Cleared all records');
    },

    getRecordsByCategory: (category: string) => {
      const state = get();
      return state.records.filter(
        (r) => r.data.category.toLowerCase() === category.toLowerCase()
      );
    },

    searchRecords: (query: string) => {
      const state = get();
      const lowerQuery = query.toLowerCase();
      return state.records.filter(
        (r) =>
          r.data.objectName.toLowerCase().includes(lowerQuery) ||
          r.data.description.toLowerCase().includes(lowerQuery) ||
          r.data.brand?.toLowerCase().includes(lowerQuery)
      );
    },

    getStats: () => {
      const state = get();
      const categories = new Map<string, number>();
      state.records.forEach((r) => {
        const category = r.data.category;
        categories.set(category, (categories.get(category) || 0) + 1);
      });

      return {
        totalRecords: state.records.length,
        categories: Array.from(categories.entries()).map(([name, count]) => ({
          name,
          count,
        })),
        latestRecord: state.records[0] || null,
      };
    },

    setMaxRecords: (max: number) => {
      set((state) => {
        state.maxRecords = max;

        // Trim records if necessary
        if (state.records.length > max) {
          state.records = state.records.slice(0, max);
          saveRecordsToStorage(state.records);
          debugLog(
            'ObjectRecognitionStore',
            `Updated maxRecords to ${max}, trimmed records`
          );
        }
      });
    },

    reset: () => {
      set((state) => {
        state.records = initialState.records;
        state.maxRecords = initialState.maxRecords;
      });
      storage.remove(STORAGE_KEYS.RECORDS);
      debugLog('ObjectRecognitionStore', 'Reset store');
    },
  }))
);

// ============================================
// Initialize store on module load
// ============================================

// Load persisted data when store is created
useObjectRecognitionStore.getState().loadFromStorage();
