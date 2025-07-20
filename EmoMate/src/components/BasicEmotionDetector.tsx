import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  PanResponder,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Camera,
  useFrameProcessor,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { EmotionDetectorProps, EmotionType } from '../types/emotion';
import { isDebugMode, debugLog } from '../utils/debug';
import {
  useMLKitFaceDetector,
  analyzeEmotionFromMLKitFace,
  isMLKitAvailable,
} from '../utils/faceDetection';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTAINER_WIDTH = 120;
const CONTAINER_HEIGHT = 160;

const AnimatedView = Animated.createAnimatedComponent(View);

export const BasicEmotionDetector: React.FC<EmotionDetectorProps> = (props) => {
  const {
    onEmotionDetected,
    isActive = true,
    detectionInterval = 1000,
  } = props;

  // 权限管理 - 同时支持expo-camera和react-native-vision-camera
  const [expoPermission, requestExpoPermission] = useCameraPermissions();
  const { hasPermission: visionHasPermission, requestPermission: requestVisionPermission } = useCameraPermission();

  // 获取相机设备
  const frontDevice = useCameraDevice('front');

  // 状态管理
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [faceDetected, setFaceDetected] = useState(false);
  const [useMLKit, setUseMLKit] = useState(false);
  const [detectionMode, setDetectionMode] = useState<'mlkit' | 'simulation'>(
    'simulation'
  );

  // 检测频率控制
  const lastDetectionTime = useRef(0);
  const lastMLKitDetection = useRef(0);

  // 动画值
  const scale = useSharedValue(1);

  // MLKit面部检测插件
  const mlkitDetector = useMLKitFaceDetector({
    performanceMode: 'fast',
    classificationMode: 'all',
    minFaceSize: 0.2,
    trackingEnabled: false,
  });

  // 初始化检测模式和权限
  useEffect(() => {
    const checkMLKitAvailability = async () => {
      try {
        // 暂时禁用MLKit，使用智能模拟模式
        // TODO: 在完成MLKit配置后启用真实检测
        const enableMLKit = false; // 暂时设为false

        if (enableMLKit) {
          const available = isMLKitAvailable();
          if (available && mlkitDetector && visionHasPermission) {
            setUseMLKit(true);
            setDetectionMode('mlkit');
            debugLog('BasicEmotionDetector', 'MLKit面部检测已启用');
            return;
          }
        }

        // 默认使用智能模拟模式
        setUseMLKit(false);
        setDetectionMode('simulation');
        debugLog('BasicEmotionDetector', '使用智能模拟模式');
      } catch (error) {
        debugLog(
          'BasicEmotionDetector',
          '检测MLKit可用性失败，使用模拟模式',
          error
        );
        setUseMLKit(false);
        setDetectionMode('simulation');
      }
    };

    checkMLKitAvailability();
  }, [mlkitDetector]);

  // MLKit情绪检测处理函数
  const handleMLKitDetection = useCallback(
    (emotion: EmotionType, confidence: number) => {
      const now = Date.now();
      if (now - lastMLKitDetection.current < detectionInterval) return;

      if (emotion !== currentEmotion && confidence > 0.6) {
        lastMLKitDetection.current = now;
        setCurrentEmotion(emotion);
        setFaceDetected(true);

        debugLog('BasicEmotionDetector', `MLKit检测到情绪: ${emotion}`, {
          confidence,
          mode: 'mlkit',
        });

        onEmotionDetected(emotion);

        // 重置face detected状态
        setTimeout(() => setFaceDetected(false), 1000);
      }
    },
    [currentEmotion, onEmotionDetected, detectionInterval]
  );

  // MLKit Frame Processor
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      if (!isActive || !useMLKit || !mlkitDetector) return;

      try {
        const faces = mlkitDetector.detectFaces(frame);

        if (faces.length > 0) {
          const face = faces[0]; // 使用第一个检测到的面部
          const emotionResult = analyzeEmotionFromMLKitFace(face);

          // 使用runOnJS将结果传递给主线程
          runOnJS(handleMLKitDetection)(
            emotionResult.emotion,
            emotionResult.confidence
          );
        }
      } catch (error) {
        console.warn('[BasicEmotionDetector] MLKit检测错误:', error);
      }
    },
    [isActive, useMLKit, mlkitDetector, handleMLKitDetection]
  );

  // 创建PanResponder处理拖拽
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      scale.value = withSpring(0.95);
    },
    onPanResponderMove: (_evt, gestureState) => {
      const newX = Math.max(
        0,
        Math.min(SCREEN_WIDTH - CONTAINER_WIDTH, position.x + gestureState.dx)
      );
      const newY = Math.max(
        0,
        Math.min(SCREEN_HEIGHT - CONTAINER_HEIGHT, position.y + gestureState.dy)
      );
      setPosition({ x: newX, y: newY });
    },
    onPanResponderRelease: (_evt, gestureState) => {
      scale.value = withSpring(1);
      const finalX = Math.max(
        0,
        Math.min(SCREEN_WIDTH - CONTAINER_WIDTH, position.x + gestureState.dx)
      );
      const finalY = Math.max(
        0,
        Math.min(SCREEN_HEIGHT - CONTAINER_HEIGHT, position.y + gestureState.dy)
      );
      setPosition({ x: finalX, y: finalY });
      debugLog(
        'BasicEmotionDetector',
        `Dragged to position: ${finalX}, ${finalY}`
      );
    },
  });

  // 智能情绪模拟（作为MLKit的后备方案）
  const simulateEmotionDetection = useCallback(() => {
    if (!isActive || useMLKit) return; // 如果MLKit可用则不使用模拟

    const now = Date.now();
    if (now - lastDetectionTime.current < detectionInterval) return;

    // 基于时间的智能情绪模拟
    const hour = new Date().getHours();
    let emotionWeights: Record<EmotionType, number>;

    // 根据时间段调整情绪概率
    if (hour >= 6 && hour < 12) {
      // 早上：更积极的情绪
      emotionWeights = {
        happy: 0.4,
        neutral: 0.4,
        surprised: 0.15,
        sad: 0.03,
        angry: 0.02,
      };
    } else if (hour >= 12 && hour < 18) {
      // 下午：平衡情绪
      emotionWeights = {
        happy: 0.3,
        neutral: 0.5,
        surprised: 0.1,
        sad: 0.07,
        angry: 0.03,
      };
    } else {
      // 晚上：较为平静
      emotionWeights = {
        happy: 0.25,
        neutral: 0.6,
        surprised: 0.08,
        sad: 0.05,
        angry: 0.02,
      };
    }

    // 基于权重随机选择情绪
    const rand = Math.random();
    let cumulativeWeight = 0;
    let selectedEmotion: EmotionType = 'neutral';

    for (const [emotion, weight] of Object.entries(emotionWeights)) {
      cumulativeWeight += weight;
      if (rand <= cumulativeWeight) {
        selectedEmotion = emotion as EmotionType;
        break;
      }
    }

    if (selectedEmotion !== currentEmotion) {
      lastDetectionTime.current = now;
      setCurrentEmotion(selectedEmotion);
      setFaceDetected(true);

      debugLog('BasicEmotionDetector', `智能情绪模拟: ${selectedEmotion}`, {
        timeOfDay: hour,
        probability: emotionWeights[selectedEmotion],
        mode: 'simulation',
      });
      onEmotionDetected(selectedEmotion);

      // 重置face detected状态
      setTimeout(() => setFaceDetected(false), 1000);
    }
  }, [
    isActive,
    detectionInterval,
    currentEmotion,
    onEmotionDetected,
    useMLKit,
  ]);

  // 定时器模拟面部检测（仅在非MLKit模式下）
  useEffect(() => {
    if (!isActive || useMLKit) return;

    const interval = setInterval(simulateEmotionDetection, detectionInterval);
    return () => clearInterval(interval);
  }, [isActive, simulateEmotionDetection, detectionInterval, useMLKit]);

  // 请求摄像头权限 - 支持两种相机库
  useEffect(() => {
    const requestPermissions = async () => {
      if (useMLKit && !visionHasPermission) {
        try {
          await requestVisionPermission();
        } catch (error) {
          debugLog('BasicEmotionDetector', 'Vision Camera权限请求失败', error);
        }
      } else if (!useMLKit && !expoPermission?.granted) {
        await requestExpoPermission();
      }
    };

    requestPermissions();
  }, [useMLKit, visionHasPermission, expoPermission, requestExpoPermission, requestVisionPermission]);

  // 自动返回neutral状态
  useEffect(() => {
    if (!isActive) return;

    const neutralTimeout = setTimeout(() => {
      if (currentEmotion !== 'neutral' && !faceDetected) {
        setCurrentEmotion('neutral');
        onEmotionDetected('neutral');
        debugLog('BasicEmotionDetector', 'Auto reset to neutral');
      }
    }, 5000);

    return () => clearTimeout(neutralTimeout);
  }, [isActive, currentEmotion, faceDetected, onEmotionDetected]);

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // 容器样式
  const containerStyle = [
    styles.container,
    {
      left: position.x,
      top: position.y,
    },
    animatedStyle,
  ];

  // 权限检查 - 根据检测模式使用不同的权限
  const hasPermission = useMLKit
    ? visionHasPermission
    : expoPermission?.granted;

  const requestPermissionFn = useCallback(async () => {
    if (useMLKit) {
      try {
        await requestVisionPermission();
      } catch (error) {
        debugLog('BasicEmotionDetector', '权限请求失败', error);
      }
    } else {
      await requestExpoPermission();
    }
  }, [useMLKit, requestExpoPermission, requestVisionPermission]);

  if (!expoPermission && !useMLKit) {
    return (
      <AnimatedView style={containerStyle}>
        <Text style={styles.statusText}>Permission loading...</Text>
      </AnimatedView>
    );
  }

  if (!hasPermission) {
    return (
      <AnimatedView style={containerStyle}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <TouchableOpacity
          onPress={requestPermissionFn}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </AnimatedView>
    );
  }

  if (!isActive) {
    return (
      <AnimatedView style={containerStyle}>
        <View style={styles.inactiveIndicator}>
          <Text style={styles.inactiveText}>Camera Inactive</Text>
        </View>
      </AnimatedView>
    );
  }

  return (
    <AnimatedView style={containerStyle} {...panResponder.panHandlers}>
      {/* 根据检测模式渲染不同的相机组件 */}
      {useMLKit && frontDevice ? (
        <Camera
          style={styles.camera}
          device={frontDevice}
          isActive={isActive && hasPermission}
          frameProcessor={frameProcessor}
        />
      ) : (
        <CameraView style={styles.camera} facing='front' />
      )}

      {/* 拖拽指示器 */}
      <View style={styles.dragIndicator}>
        <View style={styles.dragHandle} />
      </View>

      {/* 情绪显示指示器 */}
      <View style={styles.emotionDisplay}>
        <View
          style={[
            styles.emotionIndicator,
            currentEmotion !== 'neutral' && styles.activeIndicator,
          ]}
        >
          <Text style={styles.emotionText}>
            {currentEmotion === 'happy' && '😊'}
            {currentEmotion === 'sad' && '😔'}
            {currentEmotion === 'surprised' && '😮'}
            {currentEmotion === 'angry' && '😤'}
            {currentEmotion === 'neutral' && '😐'}
          </Text>
        </View>
        {faceDetected && (
          <View style={styles.detectingIndicator}>
            <Text style={styles.detectingText}>●</Text>
          </View>
        )}
      </View>

      {isDebugMode() && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>Emotion: {currentEmotion}</Text>
          <Text style={styles.debugText}>Mode: {detectionMode}</Text>
          <Text style={styles.debugText}>
            Detecting: {faceDetected ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.debugText}>
            X: {position.x.toFixed(0)}, Y: {position.y.toFixed(0)}
          </Text>
        </View>
      )}
    </AnimatedView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
    position: 'absolute',
    zIndex: 1000,
    borderWidth: 2,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  camera: {
    width: '100%',
    height: '65%',
  },
  dragIndicator: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dragHandle: {
    width: 30,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 1.5,
  },
  emotionDisplay: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  emotionIndicator: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  activeIndicator: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  detectingIndicator: {
    marginLeft: 6,
  },
  detectingText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emotionText: {
    fontSize: 16,
  },
  statusText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingTop: 20,
  },
  errorText: {
    fontSize: 9,
    color: '#e74c3c',
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingTop: 15,
  },
  permissionButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
  },
  inactiveIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
  },
  inactiveText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 2,
  },
  debugText: {
    fontSize: 8,
    color: 'white',
    textAlign: 'center',
  },
});
