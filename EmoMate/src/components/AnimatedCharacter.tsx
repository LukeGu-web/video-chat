import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';
import LottieView from 'lottie-react-native';
import { useAIStatus } from '../store';
import Live2DCharacter from './Live2DCharacter';

type AnimationState = 'idle' | 'speaking' | 'listening' | 'thinking' | 'happy' | 'angry' | 'love' | 'sad';

type AnimationMode = 'lottie' | 'live2d';

interface AnimatedCharacterProps {
  status?: string; // 可选，如果不传则使用全局 AI 状态
  size?: number;
  loop?: boolean;
  className?: string;
  mode?: AnimationMode; // 新增：动画模式选择
  onMotionComplete?: (motion: string, success: boolean) => void;
}

// 动画文件映射
const animationFiles: Record<AnimationState, any> = {
  idle: require('../../assets/animations/idle.json'),
  speaking: require('../../assets/animations/speaking.json'),
  listening: require('../../assets/animations/listening.json'),
  thinking: require('../../assets/animations/thinking.json'),
  happy: require('../../assets/animations/happy.json'),
  angry: require('../../assets/animations/angry.json'),
  love: require('../../assets/animations/love.json'),
  sad: require('../../assets/animations/sad.json'),
};

// 根据 status 返回对应的动画源文件
const getAnimationSource = (status: string) => {
  const validStates: AnimationState[] = ['idle', 'speaking', 'listening', 'thinking', 'happy', 'angry', 'love', 'sad'];
  const animationState: AnimationState = validStates.includes(status as AnimationState) ? status as AnimationState : 'idle';
  
  try {
    return animationFiles[animationState];
  } catch (error) {
    console.warn(`Animation file for ${status} not found, using idle animation`);
    return animationFiles.idle;
  }
};

const AnimatedCharacter: React.FC<AnimatedCharacterProps> = ({
  status,
  size = 240,
  loop = true,
  className = '',
  mode = 'live2d', // 默认使用Live2D模式
  onMotionComplete,
}) => {
  const animationRef = useRef<LottieView>(null);
  
  // 获取全局 AI 状态
  const { aiStatus } = useAIStatus();
  
  // 确定要使用的状态：优先使用传入的 status，否则使用全局 aiStatus
  const currentStatus = status || aiStatus;
  
  // 根据模式选择渲染方式
  if (mode === 'live2d') {
    return (
      <Live2DCharacter
        status={currentStatus}
        size={size}
        loop={loop}
        className={className}
        onMotionComplete={onMotionComplete}
      />
    );
  }
  
  // Lottie模式（原有实现）
  const animationSource = getAnimationSource(currentStatus);

  // 当状态改变时重新播放动画
  useEffect(() => {
    const timer = setTimeout(() => {
      if (animationRef.current) {
        animationRef.current.reset();
        animationRef.current.play();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentStatus]);

  return (
    <View 
      className={`justify-center items-center ${className}`}
      style={{ width: size, height: size }}
    >
      <LottieView
        key={currentStatus}
        ref={animationRef}
        source={animationSource}
        autoPlay={true}
        loop={loop}
        style={{ width: '100%', height: '100%' }}
        speed={1}
        resizeMode="contain"
      />
    </View>
  );
};

export default AnimatedCharacter;