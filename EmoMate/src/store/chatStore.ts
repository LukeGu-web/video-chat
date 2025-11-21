import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

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
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  reset: () => void;
}

type ChatStore = ChatState & ChatActions;

const initialState: ChatState = {
  chatHistory: [],
};

export const useChatStore = create<ChatStore>()(
  immer((set) => ({
    ...initialState,

    addChatMessage: (message: ChatMessage) => {
      set((state) => {
        state.chatHistory.push(message);
      });
    },

    clearChatHistory: () => {
      set((state) => {
        state.chatHistory = [];
      });
    },

    reset: () => {
      set((state) => {
        state.chatHistory = initialState.chatHistory;
      });
    },
  }))
);
