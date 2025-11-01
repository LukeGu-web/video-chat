/**
 * Environment Detection Test Screen
 *
 * 测试物体和环境识别功能
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useUserStore } from '../store/userStore';
import { getEnvironmentDescription } from '../utils/environmentAnalysis';
import { useChatAIWithLanLan } from '../utils/useChatAI';
import { useEnvironmentDetection } from '../utils/useEnvironmentDetection';
import { useEnvironmentDetectionMock } from '../utils/useEnvironmentDetectionMock';

export const EnvironmentTestScreen: React.FC = () => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back'); // Use back camera to detect objects
  const { currentEnvironment } = useUserStore();

  const [isDetectionActive, setIsDetectionActive] = useState(true);
  const [useMockDetection, setUseMockDetection] = useState(true); // Start with mock for testing
  const [testMessage, setTestMessage] = useState('');

  // AI chat integration
  const { messages, sendMessage, isLoading, isSpeaking } = useChatAIWithLanLan({
    enableTTS: true,
  });

  // Environment detection hook (real or mock)
  const realDetection = useEnvironmentDetection({
    isActive: isDetectionActive && !useMockDetection,
  });

  const mockDetection = useEnvironmentDetectionMock({
    isActive: isDetectionActive && useMockDetection,
  });

  // Use mock or real detection based on toggle
  const {
    modelStatus,
    currentScene,
    lastDetectedObjects,
    processFrameForObjects,
    processFrameForScene,
    updateEnvironmentContext,
  } = useMockDetection ? mockDetection : realDetection;

  // Create callback for updating environment on main thread
  const handleEnvironmentUpdate = useCallback(
    (objects: any[], scene: any, confidence: number) => {
      if (objects && scene) {
        updateEnvironmentContext(objects, scene, confidence);
      }
    },
    [updateEnvironmentContext]
  );

  // Frame processor to detect objects and scenes
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      if (!isDetectionActive) {
        return;
      }

      // Process frame for object detection
      const detectedObjects = processFrameForObjects(frame);

      // Process frame for scene classification
      const sceneResult = processFrameForScene(frame);

      // Update environment context if we have results
      if (detectedObjects && sceneResult) {
        Worklets.runOnJS(handleEnvironmentUpdate)(
          detectedObjects,
          sceneResult.scene,
          sceneResult.confidence
        );
      }
    },
    [
      isDetectionActive,
      processFrameForObjects,
      processFrameForScene,
      handleEnvironmentUpdate,
    ]
  );

  // Request permission if not granted
  React.useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  // Test AI with environment awareness
  const testAIWithEnvironment = async () => {
    if (!currentEnvironment) {
      setTestMessage('环境检测还没有数据，请稍等...');
      return;
    }

    // Ask what AI can see
    await sendMessage('你看到我周围有什么东西？');
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>需要相机权限</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>授权相机</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>找不到相机设备</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Camera view with frame processor */}
      <View style={styles.cameraContainer}>
        <Camera
          style={styles.camera}
          device={device}
          isActive={true}
          photo={false}
          video={false}
          frameProcessor={frameProcessor}
        />

        {/* Model status indicator */}
        {modelStatus !== 'ready' && (
          <View style={styles.statusOverlay}>
            <Text style={styles.statusText}>
              {modelStatus === 'loading' ? '⏳ 加载模型...' : '❌ 模型加载失败'}
            </Text>
          </View>
        )}
      </View>

      {/* Control panel */}
      <View style={styles.controlPanel}>
        <Text style={styles.title}>环境检测测试</Text>

        {/* Mock/Real toggle */}
        <TouchableOpacity
          style={[
            styles.button,
            useMockDetection ? styles.mockButton : styles.realButton,
          ]}
          onPress={() => setUseMockDetection(!useMockDetection)}
        >
          <Text style={styles.buttonText}>
            {useMockDetection ? '🧪 模拟数据模式' : '📹 真实检测模式'}
          </Text>
        </TouchableOpacity>

        {/* Detection toggle */}
        <TouchableOpacity
          style={[styles.button, !isDetectionActive && styles.buttonInactive]}
          onPress={() => setIsDetectionActive(!isDetectionActive)}
        >
          <Text style={styles.buttonText}>
            {isDetectionActive ? '✅ 检测中' : '⏸️ 已暂停'}
          </Text>
        </TouchableOpacity>

        {/* Environment info */}
        {currentEnvironment ? (
          <ScrollView style={styles.infoPanel}>
            <Text style={styles.infoTitle}>当前环境</Text>
            <Text style={styles.infoText}>
              📍 场景: {currentEnvironment.scene}
            </Text>
            <Text style={styles.infoText}>
              🏃 活动: {currentEnvironment.activity}
            </Text>
            <Text style={styles.infoText}>
              💡 光照: {currentEnvironment.lighting}
            </Text>
            <Text style={styles.infoText}>
              ✨ 置信度: {(currentEnvironment.confidence * 100).toFixed(0)}%
            </Text>

            <Text style={styles.infoTitle}>
              检测到的物体 ({currentEnvironment.objects.length})
            </Text>
            <View style={styles.objectList}>
              {currentEnvironment.objects.slice(0, 10).map((obj, idx) => (
                <Text key={idx} style={styles.objectText}>
                  {idx + 1}. {obj.label} ({(obj.confidence * 100).toFixed(0)}%)
                </Text>
              ))}
            </View>

            <Text style={styles.infoTitle}>自然语言描述</Text>
            <Text style={styles.descriptionText}>
              {getEnvironmentDescription(currentEnvironment)}
            </Text>
          </ScrollView>
        ) : (
          <View style={styles.infoPanel}>
            <Text style={styles.waitingText}>等待环境检测...</Text>
          </View>
        )}

        {/* Test AI button */}
        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={testAIWithEnvironment}
          disabled={!currentEnvironment || isLoading || isSpeaking}
        >
          <Text style={styles.buttonText}>
            {isLoading
              ? '⏳ 思考中...'
              : isSpeaking
              ? '🔊 说话中...'
              : '🤖 测试AI识别'}
          </Text>
        </TouchableOpacity>

        {/* Test message */}
        {testMessage && <Text style={styles.testMessage}>{testMessage}</Text>}

        {/* AI response */}
        {messages.length > 0 && (
          <View style={styles.aiResponsePanel}>
            <Text style={styles.aiResponseTitle}>兰兰的回答:</Text>
            <Text style={styles.aiResponseText}>
              {messages[messages.length - 1].content}
            </Text>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            💡 将相机对准物体，系统会自动识别
          </Text>
          <Text style={styles.instructionText}>
            💡 点击"测试AI识别"让兰兰告诉你她看到了什么
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  statusOverlay: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controlPanel: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    maxHeight: '50%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonInactive: {
    backgroundColor: '#666',
  },
  testButton: {
    backgroundColor: '#2196F3',
  },
  mockButton: {
    backgroundColor: '#FF9800',
  },
  realButton: {
    backgroundColor: '#9C27B0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoPanel: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    maxHeight: 100,
  },
  infoTitle: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  infoText: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 4,
  },
  objectList: {
    maxHeight: 80,
  },
  objectText: {
    color: '#ccc',
    fontSize: 11,
    marginBottom: 2,
  },
  descriptionText: {
    color: '#FFC107',
    fontSize: 12,
    fontStyle: 'italic',
  },
  waitingText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  testMessage: {
    color: '#FFC107',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  aiResponsePanel: {
    backgroundColor: '#1a3a5a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  aiResponseTitle: {
    color: '#64B5F6',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  aiResponseText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 20,
  },
  instructions: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
  },
  instructionText: {
    color: '#888',
    fontSize: 11,
    marginBottom: 4,
  },
});
