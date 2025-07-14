import React from 'react';
import Live2DCharacter from './Live2DCharacter';
import { useAIStatus } from '../store';
import { debugLog } from '../utils/debug';

interface AnimatedCharacterProps {
  status?: string;
  size?: number;
  loop?: boolean;
  className?: string;
  onMotionComplete?: (motion: string, success: boolean) => void;
}

const AnimatedCharacter: React.FC<AnimatedCharacterProps> = ({
  status,
  size = 240,
  loop = true,
  className = '',
  onMotionComplete,
}) => {
  // 获取全局 AI 状态
  const { aiStatus } = useAIStatus();
  
  // 确定要使用的状态：优先使用传入的 status，否则使用全局 aiStatus
  const currentStatus = status || aiStatus;
  
  debugLog('AnimatedCharacter', `Status: ${currentStatus} (passed: ${status}, global: ${aiStatus})`);
  
  // 直接使用Live2D组件
  return (
    <Live2DCharacter
      status={currentStatus}
      size={size}
      loop={loop}
      className={className}
      onMotionComplete={onMotionComplete}
    />
  );
};

export default AnimatedCharacter;