import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import HiyoriWebView, { HiyoriBridge } from './HiyoriWebView';
import { useAIStatus } from '../store';

type AnimationState = 'idle' | 'speaking' | 'listening' | 'thinking' | 'happy' | 'angry' | 'love' | 'sad';

interface Live2DCharacterProps {
  status?: string;
  size?: number;
  loop?: boolean;
  className?: string;
  onMotionComplete?: (motion: string, success: boolean) => void;
}

interface WebViewRef {
  hiyoriBridge: HiyoriBridge;
  reload: () => void;
  webView: any;
}

// 状态映射：8种lottie状态 → 11种Live2D motions
// 完全使用Live2D的真实动作，确保所有动作都存在
const stateMapping: Record<AnimationState, string> = {
  idle: 'Idle',           // 空闲状态 → 默认动作
  speaking: 'Speaking',   // 说话状态 → 说话动作
  listening: 'Idle',      // 听话状态 → 空闲动作（Live2D没有listening，使用idle）
  thinking: 'Thinking',   // 思考状态 → 思考动作
  happy: 'Happy',         // 开心状态 → 开心表情
  angry: 'Surprised',     // 愤怒状态 → 惊讶表情（更温和，Live2D没有angry）
  love: 'Excited',        // 爱意状态 → 兴奋表情
  sad: 'Sleepy'          // 伤心状态 → 困倦表情（Live2D用sleepy表示伤心）
};

// 扩展映射（未来可用）
const extendedMapping: Record<string, string> = {
  greeting: 'Wave',       // 打招呼
  celebration: 'Dance',   // 庆祝
  joy: 'Laugh',          // 欢乐
  surprise: 'Surprised', // 惊讶
  sleepy: 'Sleepy'       // 困倦
};

// 获取对应的Live2D motion名称
const getLive2DMotion = (status: string): string => {
  const validStates: AnimationState[] = ['idle', 'speaking', 'listening', 'thinking', 'happy', 'angry', 'love', 'sad'];
  
  // 首先检查是否是标准状态
  if (validStates.includes(status as AnimationState)) {
    return stateMapping[status as AnimationState];
  }
  
  // 检查扩展映射
  if (extendedMapping[status]) {
    return extendedMapping[status];
  }
  
  // 默认返回Idle
  console.warn(`Unknown animation status: ${status}, falling back to Idle`);
  return 'Idle';
};

const Live2DCharacter: React.FC<Live2DCharacterProps> = ({
  status,
  size = 240,
  loop = true,
  className = '',
  onMotionComplete,
}) => {
  const webViewRef = useRef<WebViewRef>(null);
  const lastMotionRef = useRef<string | null>(null);
  const motionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 获取全局 AI 状态
  const { aiStatus } = useAIStatus();
  
  // 确定要使用的状态：优先使用传入的 status，否则使用全局 aiStatus
  const currentStatus = status || aiStatus;
  
  // 组件状态
  const [isModelReady, setIsModelReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // 获取对应的Live2D motion
  const targetMotion = getLive2DMotion(currentStatus);

  // 播放Live2D动作
  const playLive2DMotion = useCallback((motionName: string) => {
    console.log(`[Live2DCharacter] Attempting to play motion: ${motionName}`);
    
    if (!isModelReady || !webViewRef.current?.hiyoriBridge) {
      console.warn(`[Live2DCharacter] Cannot play motion ${motionName} - model not ready`);
      onMotionComplete?.(motionName, false);
      return;
    }

    // 防止重复播放相同动作
    if (lastMotionRef.current === motionName && isPlaying) {
      console.log(`[Live2DCharacter] Motion ${motionName} already playing, skipping`);
      return;
    }

    setIsPlaying(true);
    lastMotionRef.current = motionName;
    
    // 播放动作
    webViewRef.current.hiyoriBridge.playMotion(motionName);
    
    // 设置超时，确保动作完成回调
    if (motionTimeoutRef.current) {
      clearTimeout(motionTimeoutRef.current);
    }
    
    motionTimeoutRef.current = setTimeout(() => {
      setIsPlaying(false);
      onMotionComplete?.(motionName, true);
    }, 3000); // 3秒后认为动作完成
    
  }, [isModelReady, isPlaying, onMotionComplete]);

  // 当状态改变时播放对应动作
  useEffect(() => {
    if (isModelReady && targetMotion) {
      console.log(`[Live2DCharacter] Status changed to: ${currentStatus} → Motion: ${targetMotion}`);
      
      // 延迟一下确保模型完全准备好
      const timer = setTimeout(() => {
        playLive2DMotion(targetMotion);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [currentStatus, targetMotion, isModelReady, playLive2DMotion]);

  // 处理模型准备就绪
  const handleModelReady = useCallback(() => {
    console.log('[Live2DCharacter] Hiyori model is ready!');
    setIsModelReady(true);
    
    // 模型准备好后立即播放当前状态对应的动作
    setTimeout(() => {
      playLive2DMotion(targetMotion);
    }, 500);
  }, [targetMotion, playLive2DMotion]);

  // 处理动作结果
  const handleMotionResult = useCallback((motion: string, success: boolean, error?: string) => {
    console.log(`[Live2DCharacter] Motion result - ${motion}: ${success ? 'Success' : `Failed: ${error}`}`);
    
    setIsPlaying(false);
    
    if (motionTimeoutRef.current) {
      clearTimeout(motionTimeoutRef.current);
    }
    
    onMotionComplete?.(motion, success);
    
    // 如果是非idle动作且成功播放，在动作完成后返回idle状态
    if (success && motion !== 'Idle' && motion !== stateMapping.idle) {
      setTimeout(() => {
        if (currentStatus === 'idle' || !currentStatus) {
          playLive2DMotion('Idle');
        }
      }, 1000);
    }
  }, [currentStatus, onMotionComplete, playLive2DMotion]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }
    };
  }, []);

  // 计算容器样式
  const containerStyle = {
    width: size,
    height: size,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <HiyoriWebView
        ref={webViewRef}
        style={styles.webView}
        onModelReady={handleModelReady}
        onMotionResult={handleMotionResult}
      />
      
      {/* 状态指示器 */}
      {__DEV__ && (
        <View style={styles.debugOverlay}>
          <View style={[
            styles.statusDot,
            { backgroundColor: isModelReady ? '#10B981' : '#EF4444' }
          ]} />
          <View style={styles.debugInfo}>
            <View style={styles.debugText}>
              <View style={styles.debugLine}>
                <Text style={styles.debugLabel}>Status:</Text>
                <Text style={styles.debugValue}>{currentStatus}</Text>
              </View>
              <View style={styles.debugLine}>
                <Text style={styles.debugLabel}>Motion:</Text>
                <Text style={styles.debugValue}>{targetMotion}</Text>
              </View>
              <View style={styles.debugLine}>
                <Text style={styles.debugLabel}>Ready:</Text>
                <Text style={styles.debugValue}>{isModelReady ? '✓' : '✗'}</Text>
              </View>
              <View style={styles.debugLine}>
                <Text style={styles.debugLabel}>Playing:</Text>
                <Text style={styles.debugValue}>{isPlaying ? '▶' : '⏸'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webView: {
    width: '100%',
    height: '100%',
  },
  debugOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 6,
    padding: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  debugInfo: {
    flex: 1,
  },
  debugText: {
    gap: 2,
  },
  debugLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontFamily: 'monospace',
    width: 50,
  },
  debugValue: {
    color: '#F3F4F6',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
});

export default Live2DCharacter;

// 导出类型和映射供外部使用
export type { AnimationState, Live2DCharacterProps };
export { stateMapping, extendedMapping, getLive2DMotion };