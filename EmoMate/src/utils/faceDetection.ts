import { useMemo } from 'react';
import { VisionCameraProxy, Frame } from 'react-native-vision-camera';
import type { EmotionType, FaceData, EmotionDetectionResult } from '../types/emotion';

// MLKit Face Detection Plugin Interface
type MLKitFaceDetectorPlugin = {
  detectFaces: (frame: Frame) => MLKitFace[];
};

// MLKit Face Interface (based on reference implementation)
interface MLKitFace {
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  smilingProbability: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rollAngle: number;
  pitchAngle: number;
  yawAngle: number;
}

// MLKit Face Detection Options
interface MLKitFaceDetectionOptions {
  performanceMode?: 'fast' | 'accurate';
  classificationMode?: 'none' | 'all';
  minFaceSize?: number;
  trackingEnabled?: boolean;
}

/**
 * 创建MLKit面部检测插件
 * 基于react-native-vision-camera-face-detector的实现方式
 */
function createMLKitFaceDetectorPlugin(
  options?: MLKitFaceDetectionOptions
): MLKitFaceDetectorPlugin | null {
  try {
    // 首先检查基础可用性
    if (!isMLKitAvailable()) {
      return null;
    }

    const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectFaces', {
      performanceMode: 'fast',
      classificationMode: 'all', // 启用情绪分类
      landmarkMode: 'none',      // 不需要landmarks
      contourMode: 'none',       // 不需要contours
      minFaceSize: 0.2,          // 最小面部大小
      trackingEnabled: false,    // 禁用跟踪以提高性能
      ...options
    });

    if (!plugin) {
      console.warn('[MLKitFaceDetector] Plugin初始化返回null');
      return null;
    }

    return {
      detectFaces: (frame: Frame): MLKitFace[] => {
        'worklet';
        try {
          // @ts-ignore - Frame processor plugin call
          const result = plugin.call(frame);
          return Array.isArray(result) ? (result as unknown) as MLKitFace[] : [];
        } catch (error) {
          console.warn('[MLKitFaceDetector] Detection failed:', error);
          return [];
        }
      }
    };
  } catch (error) {
    console.warn('[MLKitFaceDetector] Plugin initialization failed:', error);
    return null;
  }
}

/**
 * 基于MLKit面部特征分析情绪
 * 参考react-native-vision-camera-face-detector的概率算法
 */
export function analyzeEmotionFromMLKitFace(face: MLKitFace): EmotionDetectionResult {
  const { smilingProbability, leftEyeOpenProbability, rightEyeOpenProbability } = face;
  
  // 眼睛开合平均值
  const avgEyeOpen = (leftEyeOpenProbability + rightEyeOpenProbability) / 2;
  
  let emotion: EmotionType = 'neutral';
  let confidence = 0.5;

  // 情绪分析算法
  if (smilingProbability > 0.6) {
    // 高微笑概率 = 开心
    emotion = 'happy';
    confidence = Math.min(smilingProbability, 0.95);
  } else if (avgEyeOpen > 0.8 && smilingProbability < 0.3) {
    // 眼睛大睁 + 低微笑 = 惊讶
    emotion = 'surprised';
    confidence = Math.min(avgEyeOpen, 0.85);
  } else if (avgEyeOpen < 0.4 && smilingProbability < 0.2) {
    // 眼睛微闭 + 不微笑 = 悲伤
    emotion = 'sad';
    confidence = Math.min(1.0 - avgEyeOpen, 0.8);
  } else if (smilingProbability < 0.1 && avgEyeOpen > 0.5) {
    // 不微笑 + 眼睛正常 = 愤怒
    emotion = 'angry';
    confidence = Math.min(1.0 - smilingProbability, 0.75);
  }

  return {
    emotion,
    confidence,
    timestamp: Date.now()
  };
}

/**
 * 使用MLKit面部检测的Hook
 * 兼容EAS Build，无需本地原生代码修改
 */
export function useMLKitFaceDetector(
  options?: MLKitFaceDetectionOptions
): MLKitFaceDetectorPlugin | null {
  return useMemo(() => {
    return createMLKitFaceDetectorPlugin(options);
  }, [options]);
}

/**
 * 将MLKit面部数据转换为EmotionDetector格式
 */
export function convertMLKitFaceToFaceData(face: MLKitFace): FaceData {
  return {
    smilingProbability: face.smilingProbability,
    leftEyeOpenProbability: face.leftEyeOpenProbability,
    rightEyeOpenProbability: face.rightEyeOpenProbability,
    bounds: face.bounds
  };
}

/**
 * 检查MLKit插件是否可用
 */
export function isMLKitAvailable(): boolean {
  try {
    // 检查VisionCameraProxy是否可用
    if (!VisionCameraProxy || typeof VisionCameraProxy.initFrameProcessorPlugin !== 'function') {
      return false;
    }
    
    // 尝试初始化插件来检查可用性
    const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectFaces', {});
    return plugin !== null;
  } catch (error) {
    console.warn('[MLKitFaceDetector] MLKit不可用:', error);
    return false;
  }
}