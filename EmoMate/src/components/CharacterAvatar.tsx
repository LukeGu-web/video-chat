import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import CharacterWebView, { AvatarBridge } from './CharacterWebView';
import { useAIStatus, AvatarMotion } from '../store';
import { debugLog, debugError, debugWarn } from '../utils/debug';
import { useMonitorStore } from '../store/monitorStore';
import { EmotionType } from '../types/emotion';
import { emotionToVRMCommands } from '../capabilities/motion/motionMapper';
import { lipSyncBridge } from '../capabilities/speak/lipSyncBridge';

interface CharacterAvatarProps {
  status?: AvatarMotion;
  emotion?: EmotionType; // VRM emotion for expression control
  size?: number;
  loop?: boolean;
  className?: string;
  onMotionComplete?: (motion: string, success: boolean) => void;
}

interface WebViewRef {
  avatarBridge: AvatarBridge;
  reload: () => void;
  webView: any;
}

// All available avatar motions
const AVATAR_MOTIONS: AvatarMotion[] = [
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

// Validate motion is valid
const validateAvatarMotion = (
  motion: AvatarMotion | undefined
): AvatarMotion => {
  if (!motion || !AVATAR_MOTIONS.includes(motion)) {
    debugWarn(
      'CharacterAvatar',
      `Invalid motion: ${motion}, falling back to Idle`
    );
    return 'Idle';
  }
  return motion;
};

const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  status,
  emotion,
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
  const currentMotion = validateAvatarMotion(status || aiStatus);

  // 组件状态
  const [isModelReady, setIsModelReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shouldLoop, setShouldLoop] = useState(false);

  // Monitor store for debug panel
  const updateAvatarStatus = useMonitorStore((state) => state.updateAvatarStatus);

  // Sync state to monitor store
  useEffect(() => {
    updateAvatarStatus({
      currentMotion,
      isModelReady,
      isPlaying,
      shouldLoop,
    });
  }, [currentMotion, isModelReady, isPlaying, shouldLoop, updateAvatarStatus]);

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
      console.log('🔄 [CharacterAvatar] Stopped motion loop');
    }
  }, []);

  // 播放Live2D动作(单次)
  const playAvatarMotion = useCallback(
    (motionName: string, enableLoop: boolean = false) => {
      console.log(
        `🎭 [CharacterAvatar] Playing motion: ${motionName}${
          enableLoop ? ' (loop enabled)' : ''
        }`
      );
      debugLog('CharacterAvatar', `Attempting to play motion: ${motionName}`);

      if (!isModelReady || !webViewRef.current?.avatarBridge) {
        console.warn(
          `⚠️ [CharacterAvatar] Cannot play motion ${motionName} - model not ready`
        );
        debugWarn(
          'CharacterAvatar',
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
          `🔄 [CharacterAvatar] Motion ${motionName} already looping, continuing`
        );
        return;
      }

      setIsPlaying(true);
      lastMotionRef.current = motionName;
      setShouldLoop(enableLoop);

      console.log(`▶️ [CharacterAvatar] Starting motion: ${motionName}`);

      // OLD: Live2D
      // webViewRef.current.avatarBridge.playMotion(motionName);

      // NEW: VRM commands
      if (emotion && webViewRef.current.avatarBridge.sendVRMCommand) {
        const { expressionCommand, presetCommand } = emotionToVRMCommands(emotion, 1.0);
        webViewRef.current.avatarBridge.sendVRMCommand(expressionCommand);
        if (presetCommand) {
          webViewRef.current.avatarBridge.sendVRMCommand(presetCommand);
        }
      } else {
        // Fallback: send VRM preset based on motion name
        // Map Live2D motions that have no direct VRM equivalent
        const VRM_MOTION_FALLBACK: Record<string, string> = {
          dance: 'excited',
          laugh: 'happy',
        };
        const lowerName = motionName.toLowerCase();
        const presetName = VRM_MOTION_FALLBACK[lowerName] ?? lowerName;
        webViewRef.current.avatarBridge.sendVRMCommand?.({ type: 'playPreset', data: { name: presetName } });
      }

      // 清除之前的定时器
      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }

      // 如果需要循环播放(Speaking/Thinking等持续动作)
      if (enableLoop) {
        console.log(
          `🔁 [CharacterAvatar] Starting motion loop for: ${motionName}`
        );

        // 停止之前的循环
        stopMotionLoop();

        // 设置循环播放(每3秒重复播放一次)
        motionLoopIntervalRef.current = setInterval(() => {
          if (
            webViewRef.current?.avatarBridge &&
            lastMotionRef.current === motionName
          ) {
            console.log(`🔄 [CharacterAvatar] Loop replay: ${motionName}`);
            // OLD: Live2D
            // webViewRef.current.avatarBridge.playMotion(motionName);
            // NEW: VRM replay (send preset again)
            const VRM_MOTION_FALLBACK: Record<string, string> = {
              dance: 'excited',
              laugh: 'happy',
            };
            const lowerName = motionName.toLowerCase();
            const replayPreset = VRM_MOTION_FALLBACK[lowerName] ?? lowerName;
            webViewRef.current.avatarBridge.sendVRMCommand?.({ type: 'playPreset', data: { name: replayPreset } });
          }
        }, 3000);
      } else {
        // 停止循环(如果有)
        stopMotionLoop();

        // 单次播放,设置超时确保动作完成回调
        motionTimeoutRef.current = setTimeout(() => {
          console.log(`✅ [CharacterAvatar] Motion completed: ${motionName}`);
          setIsPlaying(false);
          onMotionComplete?.(motionName, true);
        }, 3000);
      }
    },
    [isModelReady, onMotionComplete, stopMotionLoop, emotion]
  );

  // 当动作改变时播放对应动作
  useEffect(() => {
    if (isModelReady && currentMotion) {
      console.log(`🔀 [CharacterAvatar] Motion changed to: ${currentMotion}`);
      debugLog('CharacterAvatar', `Motion changed to: ${currentMotion}`);

      // 判断是否需要循环播放
      const needsLoop = shouldLoopMotion(currentMotion);

      // 延迟一下确保模型完全准备好
      const timer = setTimeout(() => {
        playAvatarMotion(currentMotion, needsLoop);
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
    playAvatarMotion,
    shouldLoopMotion,
    stopMotionLoop,
  ]);

  // 处理模型准备就绪
  const handleModelReady = useCallback(() => {
    console.log('✨ [CharacterAvatar] Hiyori model is ready!');
    debugLog('CharacterAvatar', 'Hiyori model is ready!');
    setIsModelReady(true);

    // Register VRM command handler for lip sync
    lipSyncBridge.register((cmd) => {
      webViewRef.current?.avatarBridge.sendVRMCommand(cmd);
    });

    // 模型准备好后立即播放当前动作
    setTimeout(() => {
      const needsLoop = shouldLoopMotion(currentMotion);
      playAvatarMotion(currentMotion, needsLoop);
    }, 500);
  }, [currentMotion, playAvatarMotion, shouldLoopMotion]);

  // 处理动作结果
  const handleMotionResult = useCallback(
    (motion: string, success: boolean, error?: string) => {
      debugLog(
        'CharacterAvatar',
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
            playAvatarMotion('Idle');
          }
        }, 1000);
      }
    },
    [currentMotion, onMotionComplete, playAvatarMotion]
  );

  // 清理定时器、循环和 lip sync bridge
  useEffect(() => {
    return () => {
      if (motionTimeoutRef.current) {
        clearTimeout(motionTimeoutRef.current);
      }
      if (motionLoopIntervalRef.current) {
        clearInterval(motionLoopIntervalRef.current);
      }
      lipSyncBridge.unregister();
      console.log('🧹 [CharacterAvatar] Cleaned up timers and loops');
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
      <CharacterWebView
        ref={webViewRef}
        style={{ width: '100%', height: '100%' }}
        onModelReady={handleModelReady}
        onMotionResult={handleMotionResult}
      />
    </View>
  );
};

export default CharacterAvatar;

// Export types and constants for external use
export type { CharacterAvatarProps };
export { AVATAR_MOTIONS };
