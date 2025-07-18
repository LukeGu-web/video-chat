import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, PanResponder, Dimensions } from 'react-native';
import {
  Frame,
  useCameraDevice,
  useCameraPermission
} from 'react-native-vision-camera';
import {
  Face,
  Camera,
  FaceDetectionOptions
} from 'react-native-vision-camera-face-detector';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { EmotionDetectorProps, EmotionType, FaceData } from '../types/emotion';
import { isDebugMode, debugLog } from '../utils/debug';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTAINER_WIDTH = 120;
const CONTAINER_HEIGHT = 160;

const AnimatedView = Animated.createAnimatedComponent(View);

export const SimpleDraggableEmotionDetector: React.FC<EmotionDetectorProps> = ({
  onEmotionDetected,
  isActive = true,
  detectionInterval = 1000
}) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral');
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDetecting, setIsDetecting] = useState(false);
  const lastDetectionTime = useRef(0);
  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: 'fast',
    landmarkMode: 'none',
    contourMode: 'none',
    classificationMode: 'all',
    minFaceSize: 0.15,
    trackingEnabled: false
  }).current;

  // 动画值
  const scale = useSharedValue(1);

  // 创建PanResponder处理拖拽
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      scale.value = withSpring(0.95);
    },
    onPanResponderMove: (_evt, gestureState) => {
      // 限制拖拽范围在屏幕内
      const newX = Math.max(0, Math.min(SCREEN_WIDTH - CONTAINER_WIDTH, position.x + gestureState.dx));
      const newY = Math.max(0, Math.min(SCREEN_HEIGHT - CONTAINER_HEIGHT, position.y + gestureState.dy));
      
      setPosition({ x: newX, y: newY });
    },
    onPanResponderRelease: (_evt, gestureState) => {
      scale.value = withSpring(1);
      
      // 最终位置限制
      const finalX = Math.max(0, Math.min(SCREEN_WIDTH - CONTAINER_WIDTH, position.x + gestureState.dx));
      const finalY = Math.max(0, Math.min(SCREEN_HEIGHT - CONTAINER_HEIGHT, position.y + gestureState.dy));
      
      setPosition({ x: finalX, y: finalY });
      
      debugLog('SimpleDraggableEmotionDetector', `Dragged to position: ${finalX}, ${finalY}`);
    }
  });

  // 实际表情检测
  const analyzeEmotion = useCallback((faceData: FaceData): EmotionType => {
    const { smilingProbability, leftEyeOpenProbability, rightEyeOpenProbability } = faceData;
    
    // 基于面部特征概率分析情绪
    if (smilingProbability && smilingProbability > 0.7) {
      return 'happy';
    }
    
    if (leftEyeOpenProbability && rightEyeOpenProbability &&
        leftEyeOpenProbability < 0.3 && rightEyeOpenProbability < 0.3) {
      // 双眼几乎闭合可能表示疲劳或悲伤
      return 'sad';
    }
    
    if (smilingProbability && smilingProbability < 0.2) {
      // 很少笑容可能表示中性或悲伤
      return smilingProbability < 0.1 ? 'sad' : 'neutral';
    }
    
    // 检测惊讶表情 (眼睛大开但没有笑容)
    if (leftEyeOpenProbability && rightEyeOpenProbability &&
        leftEyeOpenProbability > 0.9 && rightEyeOpenProbability > 0.9 &&
        smilingProbability && smilingProbability < 0.3) {
      return 'surprised';
    }
    
    return 'neutral';
  }, []);

  // 面部检测回调
  const handleFacesDetection = useCallback((faces: Face[], _frame: Frame) => {
    if (!isActive || faces.length === 0) {
      setIsDetecting(false);
      return;
    }

    const now = Date.now();
    if (now - lastDetectionTime.current < detectionInterval) return;

    setIsDetecting(true);
    const face = faces[0]; // 使用第一个检测到的面部
    
    const faceData: FaceData = {
      smilingProbability: face.smilingProbability,
      leftEyeOpenProbability: face.leftEyeOpenProbability,
      rightEyeOpenProbability: face.rightEyeOpenProbability,
      faceID: undefined, // Face tracking ID not available in this version
      bounds: face.bounds ? {
        x: face.bounds.x,
        y: face.bounds.y,
        width: face.bounds.width,
        height: face.bounds.height
      } : undefined
    };

    const detectedEmotion = analyzeEmotion(faceData);
    
    if (detectedEmotion !== currentEmotion) {
      lastDetectionTime.current = now;
      setCurrentEmotion(detectedEmotion);
      
      debugLog('SimpleDraggableEmotionDetector', `Face detected emotion: ${detectedEmotion}`, {
        smilingProbability: face.smilingProbability,
        leftEyeOpen: face.leftEyeOpenProbability,
        rightEyeOpen: face.rightEyeOpenProbability,
        faces: faces.length
      });
      
      onEmotionDetected(detectedEmotion);
    }
  }, [isActive, detectionInterval, currentEmotion, analyzeEmotion, onEmotionDetected]);

  // 请求摄像头权限
  useEffect(() => {
    (async () => {
      if (!hasPermission) {
        const permission = await requestPermission();
        debugLog('SimpleDraggableEmotionDetector', `Camera permission: ${permission}`);
      }
    })();
  }, [hasPermission, requestPermission]);

  // 自动返回neutral状态
  useEffect(() => {
    if (!isActive) return;

    const neutralTimeout = setTimeout(() => {
      if (currentEmotion !== 'neutral' && !isDetecting) {
        setCurrentEmotion('neutral');
        onEmotionDetected('neutral');
        debugLog('SimpleDraggableEmotionDetector', 'Auto reset to neutral');
      }
    }, 5000);

    return () => clearTimeout(neutralTimeout);
  }, [isActive, currentEmotion, isDetecting, onEmotionDetected]);

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // 容器样式（包括位置）
  const containerStyle = [
    styles.container,
    {
      left: position.x,
      top: position.y,
    },
    animatedStyle,
  ];

  useEffect(() => {
    debugLog('SimpleDraggableEmotionDetector', `Detector ${isActive ? 'activated' : 'deactivated'}`);
  }, [isActive]);

  if (!device) {
    return (
      <AnimatedView style={containerStyle}>
        <Text style={styles.statusText}>No camera device found</Text>
      </AnimatedView>
    );
  }

  if (!hasPermission) {
    return (
      <AnimatedView style={containerStyle}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
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
      <Camera
        style={styles.camera}
        device={device}
        isActive={isActive}
        faceDetectionCallback={handleFacesDetection}
        faceDetectionOptions={faceDetectionOptions}
      />
      
      {/* 拖拽指示器 */}
      <View style={styles.dragIndicator}>
        <View style={styles.dragHandle} />
      </View>

      {/* 情绪显示指示器 */}
      <View style={styles.emotionDisplay}>
        <View style={[styles.emotionIndicator, currentEmotion !== 'neutral' && styles.activeIndicator]}>
          <Text style={styles.emotionText}>
            {currentEmotion === 'happy' && '😊'}
            {currentEmotion === 'sad' && '😢'}
            {currentEmotion === 'surprised' && '😲'}
            {currentEmotion === 'angry' && '😠'}
            {currentEmotion === 'neutral' && '😐'}
          </Text>
        </View>
        {isDetecting && (
          <View style={styles.detectingIndicator}>
            <Text style={styles.detectingText}>●</Text>
          </View>
        )}
      </View>

      {isDebugMode() && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>Emotion: {currentEmotion}</Text>
          <Text style={styles.debugText}>Detecting: {isDetecting ? 'Yes' : 'No'}</Text>
          <Text style={styles.debugText}>X: {position.x.toFixed(0)}, Y: {position.y.toFixed(0)}</Text>
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
    height: '65%'
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
    backgroundColor: 'rgba(0,0,0,0.3)',
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
    fontSize: 16
  },
  statusText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingTop: 20
  },
  errorText: {
    fontSize: 9,
    color: '#e74c3c',
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingTop: 15
  },
  permissionButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'center'
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold'
  },
  inactiveIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5'
  },
  inactiveText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center'
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 2
  },
  debugText: {
    fontSize: 8,
    color: 'white',
    textAlign: 'center'
  }
});