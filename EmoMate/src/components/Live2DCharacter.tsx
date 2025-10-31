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
  const motionLoopIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 获取全局 AI 状态
  const { aiStatus } = useAIStatus();

  // 确定要使用的动作：优先使用传入的 status，否则使用全局 aiStatus
  const currentMotion = validateHiyoriMotion(status || aiStatus);

  // 组件状态
  const [isModelReady, setIsModelReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shouldLoop, setShouldLoop] = useState(false);

  // 判断动作是否应该循环播放(在AI说话/思考期间持续播放)
  const shouldLoopMotion = useCallback((motionName: string): boolean => {
    const continuousMotions = ['Speaking', 'Thinking'];
    return continuousMotions.includes(motionName);
  }, []);

  // 停止循环播放
  const stopMotionLoop = useCallback(() => {
    if (motionLoopIntervalRef.current) {
      clearInterval(motionLoopIntervalRef.current);
      motionLoopIntervalRef.current = null;
      console.log('🔄 [Live2DCharacter] Stopped motion loop');
    }
  }, []);

  // 播放Live2D动作(单次)
  const playLive2DMotion = useCallback(
    (motionName: string, enableLoop: boolean = false) => {
      console.log(
        `🎭 [Live2DCharacter] Playing motion: ${motionName}${
          enableLoop ? ' (loop enabled)' : ''
        }`
      );
      debugLog('Live2DCharacter', `Attempting to play motion: ${motionName}`);

      if (!isModelReady || !webViewRef.current?.hiyoriBridge) {
        console.warn(
          `⚠️ [Live2DCharacter] Cannot play motion ${motionName} - model not ready`
        );
        debugWarn(
          'Live2DCharacter',
          `Cannot play motion ${motionName} - model not ready`
        );
        onMotionComplete?.(motionName, false);
        return;
      }

      // 如果是相同动作且在循环中,不需要重复启动
      if (
        lastMotionRef.current === motionName &&
        enableLoop &&
        motionLoopIntervalRef.current
      ) {
        console.log(
          `🔄 [Live2DCharacter] Motion ${motionName} already looping, continuing`
        );
        return;
      }

      setIsPlaying(true);
      lastMotionRef.current = motionName;
      setShouldLoop(enableLoop);

      console.log(`▶️ [Live2DCharacter] Starting motion: ${motionName}`);

      // 播放动作
      webViewRef.current.hiyoriBridge.playMotion(motionName);

      // 清除之前的定时器
      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }

      // 如果需要循环播放(Speaking/Thinking等持续动作)
      if (enableLoop) {
        console.log(
          `🔁 [Live2DCharacter] Starting motion loop for: ${motionName}`
        );

        // 停止之前的循环
        stopMotionLoop();

        // 设置循环播放(每3秒重复播放一次)
        motionLoopIntervalRef.current = setInterval(() => {
          if (
            webViewRef.current?.hiyoriBridge &&
            lastMotionRef.current === motionName
          ) {
            console.log(`🔄 [Live2DCharacter] Loop replay: ${motionName}`);
            webViewRef.current.hiyoriBridge.playMotion(motionName);
          }
        }, 3000);
      } else {
        // 停止循环(如果有)
        stopMotionLoop();

        // 单次播放,设置超时确保动作完成回调
        motionTimeoutRef.current = setTimeout(() => {
          console.log(`✅ [Live2DCharacter] Motion completed: ${motionName}`);
          setIsPlaying(false);
          onMotionComplete?.(motionName, true);
        }, 3000);
      }
    },
    [isModelReady, onMotionComplete, stopMotionLoop]
  );

  // 当动作改变时播放对应动作
  useEffect(() => {
    if (isModelReady && currentMotion) {
      console.log(`🔀 [Live2DCharacter] Motion changed to: ${currentMotion}`);
      debugLog('Live2DCharacter', `Motion changed to: ${currentMotion}`);

      // 判断是否需要循环播放
      const needsLoop = shouldLoopMotion(currentMotion);

      // 延迟一下确保模型完全准备好
      const timer = setTimeout(() => {
        playLive2DMotion(currentMotion, needsLoop);
      }, 200);

      return () => {
        clearTimeout(timer);
        // 如果动作改变,停止之前的循环
        if (currentMotion !== lastMotionRef.current) {
          stopMotionLoop();
        }
      };
    }
  }, [
    currentMotion,
    isModelReady,
    playLive2DMotion,
    shouldLoopMotion,
    stopMotionLoop,
  ]);

  // 处理模型准备就绪
  const handleModelReady = useCallback(() => {
    console.log('✨ [Live2DCharacter] Hiyori model is ready!');
    debugLog('Live2DCharacter', 'Hiyori model is ready!');
    setIsModelReady(true);

    // 模型准备好后立即播放当前动作
    setTimeout(() => {
      const needsLoop = shouldLoopMotion(currentMotion);
      playLive2DMotion(currentMotion, needsLoop);
    }, 500);
  }, [currentMotion, playLive2DMotion, shouldLoopMotion]);

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

  // 清理定时器和循环
  useEffect(() => {
    return () => {
      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }
      if (motionLoopIntervalRef.current) {
        clearInterval(motionLoopIntervalRef.current);
      }
      console.log('🧹 [Live2DCharacter] Cleaned up timers and loops');
    };
  }, []);

  // 计算容器样式
  const containerStyle = {
    width: size,
    height: size * 1.6,
  };

  return (
    <View
      className='relative items-center justify-center'
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
        <View className='absolute top-0 flex-row items-center w-48 p-2 rounded-lg left-8 bg-black/80'>
          <View
            className='w-2 h-2 mr-2 rounded-full'
            style={{
              backgroundColor: isModelReady ? '#10B981' : '#EF4444',
            }}
          />
          <View className='flex-1'>
            <View className='gap-0.5'>
              <View className='flex-row items-center'>
                <Text className='w-12 font-mono text-xs text-gray-400 min-w-20'>
                  Motion:
                </Text>
                <Text className='font-mono text-xs font-bold text-gray-100'>
                  {currentMotion}
                </Text>
              </View>
              <View className='flex-row items-center'>
                <Text className='w-12 font-mono text-xs text-gray-400'>
                  Ready:
                </Text>
                <Text className='font-mono text-xs font-bold text-gray-100'>
                  {isModelReady ? '✓' : '✗'}
                </Text>
              </View>
              <View className='flex-row items-center'>
                <Text className='w-12 font-mono text-xs text-gray-400 min-w-20'>
                  Playing:
                </Text>
                <Text className='font-mono text-xs font-bold text-gray-100'>
                  {isPlaying ? '▶' : '⏸'}
                </Text>
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
