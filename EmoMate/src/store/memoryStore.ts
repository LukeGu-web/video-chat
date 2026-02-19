import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';
import { UserProfile, UserPreferences } from '../types/memory';
import { ChatMessage } from './chatStore';
import { debugLog } from '../utils/debug';

const storage = createMMKV({
  id: 'memory-storage',
  encryptionKey: 'memory-encryption-key',
});

const STORAGE_KEYS = {
  PROFILE: 'user_profile',
  PREFERENCES: 'user_preferences',
  PENDING_EXTRACTION: 'pending_extraction',
  UNPROCESSED_MESSAGES: 'unprocessed_messages',
  LAST_EXTRACTION_TIMESTAMP: 'last_extraction_timestamp',
  PROCESSED_MESSAGE_COUNT: 'processed_message_count',
} as const;

const DEFAULT_PROFILE: UserProfile = {
  tags: [],
  preferredLanguage: 'zh',
};

const DEFAULT_PREFERENCES: UserPreferences = {
  wantsAdvice: false,
  prefersHumor: false,
  replyLength: 'short',
  sensitiveTopics: [],
  formalityLevel: 'casual',
};

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = storage.getString(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

interface MemoryState {
  profile: UserProfile;
  preferences: UserPreferences;
  pendingExtraction: boolean;
  unprocessedMessages: ChatMessage[];
  lastExtractionTimestamp: number | null;
  processedMessageCount: number;
}

interface MemoryActions {
  loadFromStorage: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  setPendingExtraction: (pending: boolean, messages?: ChatMessage[]) => void;
  clearPendingExtraction: () => void;
  setLastExtractionTimestamp: (timestamp: number) => void;
  incrementProcessedCount: (count: number) => void;
  getUnprocessedMessageCount: () => number;
}

type MemoryStore = MemoryState & MemoryActions;

export const useMemoryStore = create<MemoryStore>()(
  immer((set, get) => ({
    profile: DEFAULT_PROFILE,
    preferences: DEFAULT_PREFERENCES,
    pendingExtraction: false,
    unprocessedMessages: [],
    lastExtractionTimestamp: null,
    processedMessageCount: 0,

    loadFromStorage: () => {
      const profile = loadJSON(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE);
      const preferences = loadJSON(STORAGE_KEYS.PREFERENCES, DEFAULT_PREFERENCES);
      const pendingExtraction = storage.getBoolean(STORAGE_KEYS.PENDING_EXTRACTION) ?? false;
      const unprocessedMessages = loadJSON<ChatMessage[]>(STORAGE_KEYS.UNPROCESSED_MESSAGES, []);
      const lastExtractionTimestamp =
        storage.getNumber(STORAGE_KEYS.LAST_EXTRACTION_TIMESTAMP) ?? null;
      const processedMessageCount =
        storage.getNumber(STORAGE_KEYS.PROCESSED_MESSAGE_COUNT) ?? 0;

      set((state) => {
        state.profile = profile;
        state.preferences = preferences;
        state.pendingExtraction = pendingExtraction;
        state.unprocessedMessages = unprocessedMessages;
        state.lastExtractionTimestamp = lastExtractionTimestamp;
        state.processedMessageCount = processedMessageCount;
      });
      debugLog('memoryStore', 'Loaded from storage', {
        pendingExtraction,
        unprocessedMessages: unprocessedMessages.length,
      });
    },

    updateProfile: (updates) => {
      set((state) => {
        Object.assign(state.profile, updates);
        saveJSON(STORAGE_KEYS.PROFILE, state.profile);
      });
      debugLog('memoryStore', 'Profile updated', updates);
    },

    updatePreferences: (updates) => {
      set((state) => {
        Object.assign(state.preferences, updates);
        saveJSON(STORAGE_KEYS.PREFERENCES, state.preferences);
      });
      debugLog('memoryStore', 'Preferences updated', updates);
    },

    setPendingExtraction: (pending, messages) => {
      set((state) => {
        state.pendingExtraction = pending;
        if (messages !== undefined) {
          state.unprocessedMessages = messages;
          saveJSON(STORAGE_KEYS.UNPROCESSED_MESSAGES, messages);
        }
        storage.set(STORAGE_KEYS.PENDING_EXTRACTION, pending);
      });
    },

    clearPendingExtraction: () => {
      set((state) => {
        state.pendingExtraction = false;
        state.unprocessedMessages = [];
        storage.set(STORAGE_KEYS.PENDING_EXTRACTION, false);
        saveJSON(STORAGE_KEYS.UNPROCESSED_MESSAGES, []);
      });
    },

    setLastExtractionTimestamp: (timestamp) => {
      set((state) => {
        state.lastExtractionTimestamp = timestamp;
        storage.set(STORAGE_KEYS.LAST_EXTRACTION_TIMESTAMP, timestamp);
      });
    },

    incrementProcessedCount: (count) => {
      set((state) => {
        state.processedMessageCount += count;
        storage.set(STORAGE_KEYS.PROCESSED_MESSAGE_COUNT, state.processedMessageCount);
      });
    },

    getUnprocessedMessageCount: () => {
      return get().unprocessedMessages.length;
    },
  }))
);
