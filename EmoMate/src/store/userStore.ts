import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface EmotionLog {
  date: string;
  emotion: string;
}

interface UserState {
  selectedCharacter: string;
  emotionLog: EmotionLog[];
}

interface UserActions {
  setSelectedCharacter: (character: string) => void;
  addEmotionLog: (log: EmotionLog) => void;
  reset: () => void;
}

type UserStore = UserState & UserActions;

const initialState: UserState = {
  selectedCharacter: '',
  emotionLog: [],
};

export const useUserStore = create<UserStore>()(
  immer((set) => ({
    ...initialState,
    
    setSelectedCharacter: (character: string) => {
      set((state) => {
        state.selectedCharacter = character;
      });
    },
    
    addEmotionLog: (log: EmotionLog) => {
      set((state) => {
        state.emotionLog.push(log);
      });
    },
    
    reset: () => {
      set((state) => {
        state.selectedCharacter = initialState.selectedCharacter;
        state.emotionLog = initialState.emotionLog;
      });
    },
  }))
);