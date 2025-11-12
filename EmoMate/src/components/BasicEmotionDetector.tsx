import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  Pressable,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import type { FaceDetectionOptions } from 'react-native-vision-camera-face-detector';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { EmotionDetectorProps, EmotionType } from '../types/emotion';
import { isDebugMode, debugLog } from '../utils/debug';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTAINER_WIDTH = 120;
const CONTAINER_HEIGHT = 160;

const AnimatedView = Animated.createAnimatedComponent(View);

export const BasicEmotionDetector: React.FC<EmotionDetectorProps> = (props) => {
  const {
    onEmotionDetected,
    isActive = true,
    detectionInterval = 1000,
    onFrameCaptured,
    frameCaptureInterval = 30000, // 30 seconds default
  } = props;

  // 权限管理 - 使用react-native-vision-camera
  const [cameraPosition, setCameraPosition] = useState<string>('front');
  const {
    hasPermission,
    requestPermission,
  } = useCameraPermission();

  // 获取相机设备
  const frontDevice = useCameraDevice(cameraPosition as 'front' | 'back');

  // 状态管理
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [faceDetected, setFaceDetected] = useState(false);
  const [useMLKit, setUseMLKit] = useState(false);
  const [detectionMode, setDetectionMode] = useState<'mlkit' | 'simulation'>(
    'simulation'
  );

  // Detection frequency control
  const lastDetectionTime = useRef(0);
  const lastMLKitDetection = useRef(0);
  const lastFrameCapture = useRef(0); // Scene understanding frame capture timing

  // Timeout management for cleanup
  const faceDetectedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 动画值
  const scale = useSharedValue(1);

  // MLKit face detection options - Full power mode with landmarks and contours
  const faceDetectionOptions = React.useMemo<FaceDetectionOptions>(
    () => ({
      performanceMode: 'accurate', // Use accurate mode for better emotion detection
      classificationMode: 'all', // Enable smiling and eye open probabilities
      landmarkMode: 'all', // Enable facial landmarks detection
      contourMode: 'all', // Enable facial contours detection
      minFaceSize: 0.15, // Minimum face size ratio
      trackingEnabled: false, // Disabled because contourMode is enabled (conflict)
    }),
    []
  );

  // Use the hook to get detectFaces function
  const { detectFaces } = useFaceDetector(faceDetectionOptions);

  // Camera ref for taking snapshots
  const cameraRef = useRef<Camera>(null);

  // 初始化检测模式和权限
  useEffect(() => {
    const checkMLKitAvailability = async () => {
      try {
        // 启用真实面部检测 (react-native-vision-camera-face-detector 1.9.0)
        const enableMLKit = true; // 已升级到1.9.0，现在启用真实检测

        if (enableMLKit && hasPermission) {
          setUseMLKit(true);
          setDetectionMode('mlkit');
          debugLog(
            'BasicEmotionDetector',
            'MLKit面部检测已启用 (v1.9.0 - Callback方式)'
          );
          return;
        }

        // 如果MLKit不可用，使用智能模拟模式作为后备
        setUseMLKit(false);
        setDetectionMode('simulation');
        debugLog('BasicEmotionDetector', '使用智能模拟模式 (MLKit后备)');
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
  }, [hasPermission]);

  // Callback to update emotion on JS thread
  const updateEmotionCallback = useCallback(
    (emotion: EmotionType, confidence: number) => {
      setCurrentEmotion(emotion);
      setFaceDetected(true);
      onEmotionDetected(emotion);
      debugLog('BasicEmotionDetector', `MLKit detected emotion: ${emotion}`, {
        confidence,
      });

      // Clear existing timeout to prevent memory leak
      if (faceDetectedTimeoutRef.current) {
        clearTimeout(faceDetectedTimeoutRef.current);
      }

      // Set new timeout with ref tracking
      faceDetectedTimeoutRef.current = setTimeout(() => {
        setFaceDetected(false);
        faceDetectedTimeoutRef.current = null;
      }, 1000);
    },
    [onEmotionDetected]
  );

  // Create worklet-compatible callback
  const updateEmotionWorklet = Worklets.createRunOnJS(updateEmotionCallback);

  // Callback to handle frame capture for scene understanding
  const handleFrameCaptureCallback = useCallback(
    (base64: string, timestamp: number) => {
      if (onFrameCaptured) {
        onFrameCaptured(base64, timestamp);
        debugLog('BasicEmotionDetector', `Frame captured for scene understanding`, {
          timestamp,
          size: base64.length,
        });
      }
    },
    [onFrameCaptured]
  );

  // Create worklet-compatible callback for frame capture
  const handleFrameCaptureWorklet = Worklets.createRunOnJS(
    handleFrameCaptureCallback
  );

  // Helper function to calculate distance between two points
  const calculateDistance = (p1: any, p2: any): number => {
    'worklet';
    if (!p1 || !p2) return 0;
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Frame processor for face detection with Plutchik's 8 emotions
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      try {
        const faces = detectFaces(frame);

        if (faces && faces.length > 0) {
          const face = faces[0];

          // Basic classification probabilities
          const smilingProb = face.smilingProbability ?? 0;
          const leftEyeProb = face.leftEyeOpenProbability ?? 0.5;
          const rightEyeProb = face.rightEyeOpenProbability ?? 0.5;
          const avgEyeOpen = (leftEyeProb + rightEyeProb) / 2;

          // Landmarks-based features
          const landmarks = face.landmarks as any; // MLKit landmarks structure
          let mouthAspectRatio = 1.0;

          // Calculate mouth aspect ratio from landmarks if available
          if (landmarks) {
            // Try to access mouth landmarks (property names may vary by MLKit version)
            const leftMouth = landmarks.MOUTH_LEFT || landmarks.leftMouth;
            const rightMouth = landmarks.MOUTH_RIGHT || landmarks.rightMouth;
            const bottomMouth = landmarks.MOUTH_BOTTOM || landmarks.bottomMouth;

            if (leftMouth && rightMouth && bottomMouth) {
              const mouthWidth = calculateDistance(leftMouth, rightMouth);
              const mouthHeight = calculateDistance(
                {
                  x: (leftMouth.x + rightMouth.x) / 2,
                  y: (leftMouth.y + rightMouth.y) / 2,
                },
                bottomMouth
              );
              mouthAspectRatio =
                mouthHeight > 0 ? mouthWidth / mouthHeight : 1.0;
            }
          }

          // Head pose angles
          const pitchAngle = face.pitchAngle ?? 0;
          const yawAngle = face.yawAngle ?? 0;

          // Plutchik's 8 basic emotions detection
          let emotion: EmotionType = 'neutral';
          let confidence = 0.5;

          // 1. Joy (喜悦) - High smile + moderate eye open + wide mouth
          if (smilingProb > 0.7 && avgEyeOpen > 0.5) {
            emotion = 'joy';
            confidence = Math.min((smilingProb + avgEyeOpen) / 2, 0.95);
          }
          // 2. Sadness (悲伤) - Low smile + eyes partially closed + head down
          else if (avgEyeOpen < 0.4 && smilingProb < 0.2) {
            emotion = 'sadness';
            confidence = Math.min(1.0 - avgEyeOpen, 0.85);
          }
          // 3. Anger (愤怒) - No smile + eyes wide + tight mouth
          else if (
            smilingProb < 0.15 &&
            avgEyeOpen > 0.6 &&
            mouthAspectRatio > 2.5
          ) {
            emotion = 'anger';
            confidence = Math.min((1.0 - smilingProb + avgEyeOpen) / 2, 0.8);
          }
          // 4. Fear (恐惧) - Eyes very wide + mouth open + no smile
          else if (
            avgEyeOpen > 0.85 &&
            smilingProb < 0.3 &&
            mouthAspectRatio < 2.0
          ) {
            emotion = 'fear';
            confidence = Math.min(avgEyeOpen, 0.8);
          }
          // 5. Surprise (惊讶) - Eyes very wide + mouth very open
          else if (avgEyeOpen > 0.8 && mouthAspectRatio < 1.5) {
            emotion = 'surprise';
            confidence = Math.min(avgEyeOpen, 0.85);
          }
          // 6. Disgust (厌恶) - Eyes partially closed + nose wrinkle + slight frown
          else if (avgEyeOpen < 0.5 && smilingProb < 0.2) {
            emotion = 'disgust';
            confidence = 0.7;
          }
          // 7. Trust (信任) - Moderate smile + relaxed eyes + direct gaze
          else if (
            smilingProb > 0.4 &&
            smilingProb < 0.7 &&
            avgEyeOpen > 0.5 &&
            Math.abs(yawAngle) < 15
          ) {
            emotion = 'trust';
            confidence = 0.75;
          }
          // 8. Anticipation (期待) - Eyes wide + slight smile + head slightly forward
          else if (avgEyeOpen > 0.7 && smilingProb > 0.3 && smilingProb < 0.6) {
            emotion = 'anticipation';
            confidence = 0.7;
          }

          const now = Date.now();
          const lastTime = lastMLKitDetection.current;

          if (now - lastTime >= detectionInterval && confidence > 0.6) {
            lastMLKitDetection.current = now;

            // Call JS function from worklet context
            updateEmotionWorklet(emotion, confidence);
          }
        }
      } catch (error) {
        // Log frame processing errors in debug mode
        if (isDebugMode()) {
          console.error(
            '[BasicEmotionDetector] Frame processing error:',
            error
          );
        }
      }
    },
    [detectFaces, detectionInterval, updateEmotionWorklet]
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

    // 根据时间段调整情绪概率（Plutchik 8种基本情绪）
    if (hour >= 6 && hour < 12) {
      // 早上：更积极的情绪
      emotionWeights = {
        joy: 0.35,
        trust: 0.2,
        anticipation: 0.15,
        neutral: 0.2,
        surprise: 0.05,
        sadness: 0.02,
        fear: 0.01,
        anger: 0.01,
        disgust: 0.01,
      };
    } else if (hour >= 12 && hour < 18) {
      // 下午：平衡情绪
      emotionWeights = {
        joy: 0.25,
        trust: 0.15,
        anticipation: 0.1,
        neutral: 0.3,
        surprise: 0.08,
        sadness: 0.05,
        fear: 0.02,
        anger: 0.03,
        disgust: 0.02,
      };
    } else {
      // 晚上：较为平静
      emotionWeights = {
        joy: 0.2,
        trust: 0.25,
        anticipation: 0.05,
        neutral: 0.35,
        surprise: 0.05,
        sadness: 0.05,
        fear: 0.02,
        anger: 0.02,
        disgust: 0.01,
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

      debugLog(
        'BasicEmotionDetector',
        `Intelligent emotion simulation: ${selectedEmotion}`,
        {
          timeOfDay: hour,
          probability: emotionWeights[selectedEmotion],
          mode: 'simulation',
        }
      );
      onEmotionDetected(selectedEmotion);

      // Clear existing timeout to prevent memory leak
      if (faceDetectedTimeoutRef.current) {
        clearTimeout(faceDetectedTimeoutRef.current);
      }

      // Set new timeout with ref tracking
      faceDetectedTimeoutRef.current = setTimeout(() => {
        setFaceDetected(false);
        faceDetectedTimeoutRef.current = null;
      }, 1000);
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

  // 请求摄像头权限 - 使用react-native-vision-camera
  useEffect(() => {
    const requestPermissions = async () => {
      if (useMLKit && !hasPermission) {
        try {
          await requestPermission();
          debugLog('BasicEmotionDetector', 'Camera permission requested');
        } catch (error) {
          debugLog('BasicEmotionDetector', 'Camera permission request failed', error);
        }
      }
    };

    requestPermissions();
  }, [useMLKit, hasPermission, requestPermission]);

  // Scene understanding frame capture using takeSnapshot
  useEffect(() => {
    console.log('[BasicEmotionDetector] 🔧 Frame capture effect triggered', {
      isActive,
      hasOnFrameCaptured: !!onFrameCaptured,
      hasPermission,
      frameCaptureInterval,
    });

    if (!isActive) {
      console.log('[BasicEmotionDetector] ⏸️ Frame capture disabled: isActive = false');
      return;
    }
    if (!onFrameCaptured) {
      console.log('[BasicEmotionDetector] ⏸️ Frame capture disabled: no onFrameCaptured callback');
      return;
    }
    if (!hasPermission) {
      console.log('[BasicEmotionDetector] ⏸️ Frame capture disabled: no camera permission');
      return;
    }

    console.log('[BasicEmotionDetector] ✅ Starting frame capture with interval:', frameCaptureInterval, 'ms');

    // Delay first capture to ensure camera is ready
    const initialDelay = setTimeout(() => {
      console.log('[BasicEmotionDetector] ⏰ Initial delay complete, starting frame capture...');
      const captureFrame = async () => {
        const now = Date.now();
        const timeSinceLastCapture = now - lastFrameCapture.current;
        console.log('[BasicEmotionDetector] 🎬 captureFrame called', {
          timeSinceLastCapture,
          frameCaptureInterval,
          shouldCapture: timeSinceLastCapture >= frameCaptureInterval,
        });

        if (now - lastFrameCapture.current < frameCaptureInterval) {
          console.log('[BasicEmotionDetector] ⏭️ Skipping capture (too soon)');
          return;
        }

        try {
          console.log('[BasicEmotionDetector] 📸 Attempting to capture frame...');

          if (!cameraRef.current) {
            console.warn('[BasicEmotionDetector] ⚠️ Camera ref not ready, skipping frame capture');
            debugLog('BasicEmotionDetector', 'Camera ref not ready, skipping frame capture');
            return;
          }

          const snapshot = await cameraRef.current.takeSnapshot({
            quality: 85,
          });

          if (snapshot?.path) {
            // Read the file and convert to base64
            const base64 = await fetch(`file://${snapshot.path}`)
              .then((res) => res.blob())
              .then((blob) => {
                return new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const result = reader.result as string;
                    // Remove the data:image/...;base64, prefix
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              });

            lastFrameCapture.current = now;
            onFrameCaptured(base64, Date.now());
            console.log('[BasicEmotionDetector] 📸 Frame captured (30s interval)');
            debugLog('BasicEmotionDetector', 'Frame captured via takeSnapshot', {
              timestamp: now,
              size: base64.length,
            });
          }
        } catch (error) {
          console.error('[BasicEmotionDetector] ❌ Frame capture error:', error);
          debugLog('BasicEmotionDetector', 'Frame capture error', error);
        }
      };

      // Start interval after initial delay
      console.log('[BasicEmotionDetector] ⏱️ Setting up interval with period:', frameCaptureInterval, 'ms');
      const interval = setInterval(captureFrame, frameCaptureInterval);

      // Capture first frame immediately after delay
      console.log('[BasicEmotionDetector] 🎬 Capturing first frame immediately...');
      captureFrame();

      return () => {
        console.log('[BasicEmotionDetector] 🛑 Clearing frame capture interval');
        clearInterval(interval);
      };
    }, 2000); // Wait 2 seconds for camera to be ready

    return () => {
      console.log('[BasicEmotionDetector] 🛑 Clearing initial delay timeout');
      clearTimeout(initialDelay);
    };
  }, [isActive, onFrameCaptured, frameCaptureInterval, hasPermission]);

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (faceDetectedTimeoutRef.current) {
        clearTimeout(faceDetectedTimeoutRef.current);
        faceDetectedTimeoutRef.current = null;
      }
    };
  }, []);

  // Auto reset to neutral state
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

  // 容器样式 - Dynamic positioning and animation as inline style
  const containerInlineStyle = [
    {
      left: position.x,
      top: position.y,
      width: CONTAINER_WIDTH,
      height: CONTAINER_HEIGHT,
    },
    animatedStyle,
  ];

  // Render permission request UI if needed
  if (!hasPermission) {
    return (
      <AnimatedView
        className="absolute z-[1000] rounded-xl overflow-hidden bg-[#f8f9fa] border-2 border-[#e9ecef]"
        style={containerInlineStyle}
      >
        <Text className="text-[9px] text-[#e74c3c] text-center px-1.5 pt-3.5">
          Camera permission required
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-[#3498db] px-2 py-1 rounded mx-auto mt-2"
        >
          <Text className="text-white text-[9px] font-bold">Grant Permission</Text>
        </TouchableOpacity>
      </AnimatedView>
    );
  }

  if (!isActive) {
    return (
      <AnimatedView
        className="absolute z-[1000] rounded-xl overflow-hidden bg-[#f8f9fa] border-2 border-[#e9ecef]"
        style={containerInlineStyle}
      >
        <View className="justify-center items-center w-full h-full bg-[#f5f5f5]">
          <Text className="text-[10px] text-[#666] text-center">Camera Inactive</Text>
        </View>
      </AnimatedView>
    );
  }

  return (
    <AnimatedView
      className="absolute z-[1000] rounded-xl overflow-hidden bg-[#f8f9fa] border-2 border-[#e9ecef] shadow-md"
      style={containerInlineStyle}
      {...panResponder.panHandlers}
    >
      {/* React Native Vision Camera */}
      {frontDevice && (
        <Camera
          ref={cameraRef}
          style={{ width: '100%', height: '100%' }}
          device={frontDevice}
          isActive={isActive && hasPermission}
          frameProcessor={useMLKit ? frameProcessor : undefined}
          photo={true}
        />
      )}

      {/* 拖拽指示器 */}
      <View className="absolute top-1 left-0 right-0 items-center">
        <View className="w-[30px] h-[3px] bg-white/70 rounded-full" />
      </View>
      {faceDetected && (
        <View className="absolute bottom-2 left-3">
          <Text className="text-[#22c55e] text-xs font-bold">●</Text>
        </View>
      )}
      <Pressable
        className="absolute bottom-0 right-2"
        onPress={() =>
          setCameraPosition(cameraPosition === 'front' ? 'back' : 'front')
        }
      >
        <Text className="text-2xl font-extrabold text-white">↺</Text>
      </Pressable>
    </AnimatedView>
  );
};
