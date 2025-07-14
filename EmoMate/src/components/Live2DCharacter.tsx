import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import HiyoriWebView, { HiyoriBridge } from './HiyoriWebView';
import { useAIStatus, HiyoriMotion } from '../store';
import { isDebugMode, debugLog, debugError, debugWarn } from '../utils/debug';

interface Live2DCharacterProps {
  status?: HiyoriMotion; // 直接使用HiyoriMotion类型
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

// Hiyori可用的所有动作
const HIYORI_MOTIONS: HiyoriMotion[] = [
  'Idle',
  'Speaking',
  'Thinking',
  'Happy',
  'Surprised',
  'Shy',
  'Wave',
  'Dance',
  'Laugh',
  'Excited',
  'Sleepy',
];

// 验证动作是否有效
const validateHiyoriMotion = (
  motion: HiyoriMotion | undefined
): HiyoriMotion => {
  if (!motion || !HIYORI_MOTIONS.includes(motion)) {
    debugWarn(
      'Live2DCharacter',
      `Invalid motion: ${motion}, falling back to Idle`
    );
    return 'Idle';
  }
  return motion;
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

  // 确定要使用的动作：优先使用传入的 status，否则使用全局 aiStatus
  const currentMotion = validateHiyoriMotion(status || aiStatus);

  // 组件状态
  const [isModelReady, setIsModelReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // 播放Live2D动作
  const playLive2DMotion = useCallback(
    (motionName: string) => {
      debugLog('Live2DCharacter', `Attempting to play motion: ${motionName}`);

      if (!isModelReady || !webViewRef.current?.hiyoriBridge) {
        debugWarn(
          'Live2DCharacter',
          `Cannot play motion ${motionName} - model not ready`
        );
        onMotionComplete?.(motionName, false);
        return;
      }

      // 防止重复播放相同动作
      if (lastMotionRef.current === motionName && isPlaying) {
        debugLog(
          'Live2DCharacter',
          `Motion ${motionName} already playing, skipping`
        );
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
    },
    [isModelReady, isPlaying, onMotionComplete]
  );

  // 当动作改变时播放对应动作
  useEffect(() => {
    if (isModelReady && currentMotion) {
      debugLog('Live2DCharacter', `Motion changed to: ${currentMotion}`);

      // 延迟一下确保模型完全准备好
      const timer = setTimeout(() => {
        playLive2DMotion(currentMotion);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [currentMotion, isModelReady, playLive2DMotion]);

  // 处理模型准备就绪
  const handleModelReady = useCallback(() => {
    debugLog('Live2DCharacter', 'Hiyori model is ready!');
    setIsModelReady(true);

    // 模型准备好后立即播放当前动作
    setTimeout(() => {
      playLive2DMotion(currentMotion);
    }, 500);
  }, [currentMotion, playLive2DMotion]);

  // 处理动作结果
  const handleMotionResult = useCallback(
    (motion: string, success: boolean, error?: string) => {
      debugLog(
        'Live2DCharacter',
        `Motion result - ${motion}: ${success ? 'Success' : `Failed: ${error}`}`
      );

      setIsPlaying(false);

      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }

      onMotionComplete?.(motion, success);

      // 如果是非idle动作且成功播放，在动作完成后返回idle状态
      if (success && motion !== 'Idle') {
        setTimeout(() => {
          if (currentMotion === 'Idle') {
            playLive2DMotion('Idle');
          }
        }, 1000);
      }
    },
    [currentMotion, onMotionComplete, playLive2DMotion]
  );

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
    height: size * 1.6,
  };

  return (
    <View 
      className="relative justify-center items-center"
      style={containerStyle}
    >
      <HiyoriWebView
        ref={webViewRef}
        style={{ width: '100%', height: '100%' }}
        onModelReady={handleModelReady}
        onMotionResult={handleMotionResult}
      />

      {/* 状态指示器 */}
      {isDebugMode() && (
        <View className="absolute top-2 left-2 flex-row items-center bg-black/80 rounded-md p-2">
          <View
            className="w-2 h-2 rounded-full mr-2"
            style={{
              backgroundColor: isModelReady ? '#10B981' : '#EF4444',
            }}
          />
          <View className="flex-1">
            <View className="gap-0.5">
              <View className="flex-row items-center">
                <Text className="text-gray-400 text-xs font-mono w-12">Motion:</Text>
                <Text className="text-gray-100 text-xs font-mono font-bold">{currentMotion}</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-gray-400 text-xs font-mono w-12">Ready:</Text>
                <Text className="text-gray-100 text-xs font-mono font-bold">
                  {isModelReady ? '✓' : '✗'}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-gray-400 text-xs font-mono w-12">Playing:</Text>
                <Text className="text-gray-100 text-xs font-mono font-bold">{isPlaying ? '▶' : '⏸'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};


export default Live2DCharacter;

// 导出类型和常量供外部使用
export type { Live2DCharacterProps };
export { HIYORI_MOTIONS, validateHiyoriMotion };
