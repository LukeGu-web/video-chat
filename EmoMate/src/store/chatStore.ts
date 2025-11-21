/**
 * Chat Store - Zustand with MMKV Persistence
 * Manages chat history with automatic persistence
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createMMKV } from 'react-native-mmkv';

// ============================================
// MMKV Storage Instance
// ============================================

const storage = createMMKV({
  id: 'chat-storage',
  encryptionKey: 'chat-encryption-key',
});

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  CHAT_HISTORY: 'chat_history',
} as const;

// ============================================
// Types
// ============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isVoiceMessage?: boolean; // Mark if this is a voice message
}

interface ChatState {
  chatHistory: ChatMessage[];
}

interface ChatActions {
  loadFromStorage: () => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  reset: () => void;
}

type ChatStore = ChatState & ChatActions;

// ============================================
// Initial State
// ============================================

const initialState: ChatState = {
  chatHistory: [],
};

// ============================================
// Helper Functions
// ============================================

/**
 * Load chat history from MMKV storage
 */
function loadChatHistory(): ChatMessage[] {
  try {
    const historyJson = storage.getString(STORAGE_KEYS.CHAT_HISTORY);
    if (historyJson) {
      const history = JSON.parse(historyJson);
      console.log('[ChatStore] Loaded chat history from storage', {
        messageCount: history.length,
      });
      return history;
    }
    return [];
  } catch (error) {
    console.error('[ChatStore] Failed to load chat history', error);
    return [];
  }
}

/**
 * Save chat history to MMKV storage
 */
function saveChatHistory(chatHistory: ChatMessage[]): void {
  try {
    storage.set(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(chatHistory));
    console.log('[ChatStore] Saved chat history to storage', {
      messageCount: chatHistory.length,
    });
  } catch (error) {
    console.error('[ChatStore] Failed to save chat history', error);
  }
}

// ============================================
// Store Definition
// ============================================

export const useChatStore = create<ChatStore>()(
  immer((set) => ({
    ...initialState,

    loadFromStorage: () => {
      const chatHistory = loadChatHistory();
      set((state) => {
        state.chatHistory = chatHistory;
      });
    },

    addChatMessage: (message: ChatMessage) => {
      set((state) => {
        state.chatHistory.push(message);
        // Save to storage after adding message
        saveChatHistory(state.chatHistory);
      });
    },

    clearChatHistory: () => {
      set((state) => {
        state.chatHistory = [];
        // Clear from storage
        storage.remove(STORAGE_KEYS.CHAT_HISTORY);
        console.log('[ChatStore] Cleared chat history');
      });
    },

    reset: () => {
      set((state) => {
        state.chatHistory = initialState.chatHistory;
        // Clear from storage on reset
        storage.remove(STORAGE_KEYS.CHAT_HISTORY);
        console.log('[ChatStore] Reset chat store');
      });
    },
  }))
);

// ============================================
// Initialize store on module load
// ============================================

// Load persisted data when store is created
useChatStore.getState().loadFromStorage();
