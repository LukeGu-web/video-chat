import { create } from 'zustand';

// AI 状态类型定义
type AIStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

// AI 状态 store 接口
interface AIStatusStore {
  aiStatus: AIStatus;
  setAIStatus: (status: AIStatus) => void;
}

// 创建 AI 状态 store
export const useAIStatus = create<AIStatusStore>((set) => ({
  aiStatus: 'idle',
  setAIStatus: (status: AIStatus) => {
    set({ aiStatus: status });
  },
}));

export default useAIStatus;