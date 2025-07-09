import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AnimatedCharacter from './AnimatedCharacter';

// 动画状态类型
type AnimationState = 'idle' | 'speaking' | 'listening' | 'thinking' | 'happy' | 'angry' | 'love' | 'sad';

const LottieTest: React.FC = () => {
  const [currentState, setCurrentState] = useState<AnimationState>('idle');

  const handleStateChange = (newState: AnimationState) => {
    console.log(`Switching to ${newState} animation`);
    setCurrentState(newState);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AnimatedCharacter 测试</Text>
      
      {/* 当前状态显示 */}
      <Text style={styles.currentState}>
        当前状态: {currentState}
      </Text>

      {/* 动画容器 - 使用 AnimatedCharacter 组件 */}
      <View style={styles.animationContainer}>
        <AnimatedCharacter 
          status={currentState}
          size={200}
          loop={true}
          className="bg-white rounded-lg shadow-lg"
        />
      </View>

      {/* 控制按钮 */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, currentState === 'idle' && styles.activeButton]}
          onPress={() => handleStateChange('idle')}
        >
          <Text style={styles.buttonText}>待机</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, currentState === 'speaking' && styles.activeButton]}
          onPress={() => handleStateChange('speaking')}
        >
          <Text style={styles.buttonText}>说话</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, currentState === 'listening' && styles.activeButton]}
          onPress={() => handleStateChange('listening')}
        >
          <Text style={styles.buttonText}>听取</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, currentState === 'thinking' && styles.activeButton]}
          onPress={() => handleStateChange('thinking')}
        >
          <Text style={styles.buttonText}>思考</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, currentState === 'happy' && styles.activeButton]}
          onPress={() => handleStateChange('happy')}
        >
          <Text style={styles.buttonText}>开心</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, currentState === 'angry' && styles.activeButton]}
          onPress={() => handleStateChange('angry')}
        >
          <Text style={styles.buttonText}>愤怒</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, currentState === 'love' && styles.activeButton]}
          onPress={() => handleStateChange('love')}
        >
          <Text style={styles.buttonText}>爱心</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, currentState === 'sad' && styles.activeButton]}
          onPress={() => handleStateChange('sad')}
        >
          <Text style={styles.buttonText}>悲伤</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  currentState: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
  },
  animationContainer: {
    width: 200,
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    margin: 4,
  },
  activeButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LottieTest;