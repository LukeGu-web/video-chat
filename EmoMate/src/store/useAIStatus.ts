import { create } from 'zustand';

// Hiyori Live2D 动作类型定义 - 直接使用Hiyori的真实动作
type HiyoriMotion = 
  | 'Idle'        // 空闲状态
  | 'Speaking'    // 说话
  | 'Thinking'    // 思考
  | 'Happy'       // 开心
  | 'Surprised'   // 惊讶
  | 'Shy'         // 害羞
  | 'Wave'        // 打招呼
  | 'Dance'       // 舞蹈
  | 'Laugh'       // 大笑
  | 'Excited'     // 兴奋
  | 'Sleepy';     // 困倦

// AI 状态 store 接口
interface AIStatusStore {
  aiStatus: HiyoriMotion;
  setAIStatus: (status: HiyoriMotion) => void;
}

// 创建 AI 状态 store
export const useAIStatus = create<AIStatusStore>((set) => ({
  aiStatus: 'Idle',
  setAIStatus: (status: HiyoriMotion) => {
    set({ aiStatus: status });
  },
}));

// 导出类型供其他组件使用
export type { HiyoriMotion };
export default useAIStatus;