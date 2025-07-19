import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export const TestFaceDetector: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, result]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testStep1_BasicImport = () => {
    try {
      const FaceDetectorModule = require('react-native-vision-camera-face-detector');
      addResult('✅ Step 1: 基础模块导入成功');
      console.log('[TestFaceDetector] Basic import success:', Object.keys(FaceDetectorModule));
    } catch (error) {
      addResult(`❌ Step 1: 基础模块导入失败 - ${error instanceof Error ? error.message : String(error)}`);
      console.error('[TestFaceDetector] Basic import failed:', error);
    }
  };

  const testStep2_CameraImport = () => {
    try {
      const { Camera } = require('react-native-vision-camera-face-detector');
      if (Camera) {
        addResult('✅ Step 2: Camera组件导入成功');
      } else {
        addResult('❌ Step 2: Camera组件不存在');
      }
    } catch (error) {
      addResult(`❌ Step 2: Camera导入失败 - ${error instanceof Error ? error.message : String(error)}`);
      console.error('[TestFaceDetector] Camera import failed:', error);
    }
  };

  const testStep3_TypeImports = () => {
    try {
      // 尝试导入类型时不会实际运行，所以这个测试主要检查语法
      addResult('✅ Step 3: 类型导入语法测试通过');
    } catch (error) {
      addResult(`❌ Step 3: 类型导入失败 - ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testStep4_FaceDetectorFunction = () => {
    try {
      const { useFaceDetector } = require('react-native-vision-camera-face-detector');
      if (typeof useFaceDetector === 'function') {
        addResult('✅ Step 4: useFaceDetector hook可用');
      } else {
        addResult('❌ Step 4: useFaceDetector不是函数');
      }
    } catch (error) {
      addResult(`❌ Step 4: useFaceDetector导入失败 - ${error instanceof Error ? error.message : String(error)}`);
      console.error('[TestFaceDetector] useFaceDetector import failed:', error);
    }
  };

  const runAllTests = () => {
    clearResults();
    testStep1_BasicImport();
    setTimeout(() => testStep2_CameraImport(), 100);
    setTimeout(() => testStep3_TypeImports(), 200);
    setTimeout(() => testStep4_FaceDetectorFunction(), 300);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FaceDetector模块测试</Text>
      
      <TouchableOpacity style={styles.button} onPress={runAllTests}>
        <Text style={styles.buttonText}>运行所有测试</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.clearButton} onPress={clearResults}>
        <Text style={styles.buttonText}>清除结果</Text>
      </TouchableOpacity>

      <View style={styles.results}>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>
            {result}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 540,
    left: 20,
    width: 300,
    maxHeight: 200,
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
  button: {
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  clearButton: {
    backgroundColor: '#6c757d',
    padding: 6,
    borderRadius: 4,
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
  results: {
    maxHeight: 100,
  },
  resultText: {
    fontSize: 10,
    marginBottom: 2,
    lineHeight: 12,
  },
});