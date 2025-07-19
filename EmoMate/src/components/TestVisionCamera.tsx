import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// 测试VisionCamera基础导入
let VisionCamera: any = null;
let hasVisionCameraError = false;

try {
  VisionCamera = require('react-native-vision-camera');
  console.log('[TestVisionCamera] VisionCamera imported successfully');
} catch (error) {
  hasVisionCameraError = true;
  console.error('[TestVisionCamera] VisionCamera import failed:', error);
}

export const TestVisionCamera: React.FC = () => {
  const [testResult, setTestResult] = useState<string>('未测试');

  const testCameraHooks = () => {
    try {
      if (!VisionCamera) {
        setTestResult('❌ VisionCamera导入失败');
        return;
      }

      // 测试基础hook
      const { useCameraDevice, useCameraPermission } = VisionCamera;
      
      if (typeof useCameraDevice !== 'function') {
        setTestResult('❌ useCameraDevice不可用');
        return;
      }

      if (typeof useCameraPermission !== 'function') {
        setTestResult('❌ useCameraPermission不可用');
        return;
      }

      setTestResult('✅ VisionCamera基础功能正常');
    } catch (error) {
      setTestResult(`❌ 测试失败: ${error instanceof Error ? error.message : String(error)}`);
      console.error('[TestVisionCamera] Test failed:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VisionCamera测试</Text>
      <Text style={styles.status}>导入状态: {hasVisionCameraError ? '❌ 失败' : '✅ 成功'}</Text>
      <TouchableOpacity style={styles.button} onPress={testCameraHooks}>
        <Text style={styles.buttonText}>测试Hooks</Text>
      </TouchableOpacity>
      <Text style={styles.result}>{testResult}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 220,
    left: 20,
    width: 200,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  status: {
    fontSize: 12,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
  result: {
    fontSize: 11,
    color: '#333',
  },
});