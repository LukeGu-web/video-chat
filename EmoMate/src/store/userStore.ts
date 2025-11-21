import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// UserStore is now minimal - chat history moved to chatStore,
// scene data moved to sceneStore, environment data removed (unused)
interface UserState {
  // Reserved for future user-specific data
  // e.g., userId, userName, userPreferences, etc.
}

interface UserActions {
  reset: () => void;
}

type UserStore = UserState & UserActions;

const initialState: UserState = {};

export const useUserStore = create<UserStore>()(
  immer((set) => ({
    ...initialState,

    reset: () => {
      set(() => initialState);
    },
  }))
);
