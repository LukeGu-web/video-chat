import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// 测试Worklets基础导入
let Worklets: any = null;
let hasWorkletsError = false;

try {
  Worklets = require('react-native-worklets-core');
  console.log('[TestWorklets] Worklets imported successfully');
} catch (error) {
  hasWorkletsError = true;
  console.error('[TestWorklets] Worklets import failed:', error);
}

// 测试Reanimated导入
let Reanimated: any = null;
let hasReanimatedError = false;

try {
  Reanimated = require('react-native-reanimated');
  console.log('[TestWorklets] Reanimated imported successfully');
} catch (error) {
  hasReanimatedError = true;
  console.error('[TestWorklets] Reanimated import failed:', error);
}

export const TestWorklets: React.FC = () => {
  const [testResult, setTestResult] = useState<string>('未测试');

  const testWorklets = () => {
    try {
      let results = [];

      // 测试Worklets
      if (!Worklets) {
        results.push('❌ Worklets导入失败');
      } else {
        results.push('✅ Worklets导入成功');
      }

      // 测试Reanimated
      if (!Reanimated) {
        results.push('❌ Reanimated导入失败');
      } else {
        const { useSharedValue, useAnimatedStyle } = Reanimated;
        if (typeof useSharedValue === 'function' && typeof useAnimatedStyle === 'function') {
          results.push('✅ Reanimated Hooks可用');
        } else {
          results.push('❌ Reanimated Hooks不可用');
        }
      }

      setTestResult(results.join('\n'));
    } catch (error) {
      setTestResult(`❌ 测试失败: ${error instanceof Error ? error.message : String(error)}`);
      console.error('[TestWorklets] Test failed:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Worklets测试</Text>
      <Text style={styles.status}>
        Worklets: {hasWorkletsError ? '❌' : '✅'} | 
        Reanimated: {hasReanimatedError ? '❌' : '✅'}
      </Text>
      <TouchableOpacity style={styles.button} onPress={testWorklets}>
        <Text style={styles.buttonText}>测试功能</Text>
      </TouchableOpacity>
      <Text style={styles.result}>{testResult}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 380,
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
    fontSize: 11,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#28a745',
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
    fontSize: 10,
    color: '#333',
    lineHeight: 14,
  },
});