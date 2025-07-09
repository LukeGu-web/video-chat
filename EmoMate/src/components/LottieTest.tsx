import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

// 动画状态类型
type AnimationState = 'idle' | 'speaking' | 'listening' | 'thinking' | 'happy' | 'angry' | 'love' | 'sad';

// 动画文件映射
const animationFiles = {
  idle: require('../../assets/animations/idle.json'),
  speaking: require('../../assets/animations/speaking.json'),
  listening: require('../../assets/animations/listening.json'),
  thinking: require('../../assets/animations/thinking.json'),
  happy: require('../../assets/animations/happy.json'),
  angry: require('../../assets/animations/angry.json'),
  love: require('../../assets/animations/love.json'),
  sad: require('../../assets/animations/sad.json'),
};

const LottieTest: React.FC = () => {
  const [currentState, setCurrentState] = useState<AnimationState>('idle');
  const animationRef = useRef<LottieView>(null);

  const handleStateChange = (newState: AnimationState) => {
    console.log(`Switching to ${newState} animation`);
    setCurrentState(newState);
  };

  // 监听状态变化，重新启动动画
  useEffect(() => {
    const timer = setTimeout(() => {
      if (animationRef.current) {
        animationRef.current.reset();
        animationRef.current.play();
      }
    }, 100); // 延迟100ms确保组件已更新

    return () => clearTimeout(timer);
  }, [currentState]);

  const handleAnimationFinish = () => {
    console.log(`Animation ${currentState} finished`);
    // 所有动画都设为循环，不需要自动回到 idle
  };

  // 模拟动画文件加载错误时的处理
  const getAnimationSource = (state: AnimationState) => {
    try {
      return animationFiles[state];
    } catch (error) {
      console.warn(`Animation file for ${state} not found, using placeholder`);
      // 返回一个简单的占位符动画或默认动画
      return null;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lottie 动画测试</Text>
      
      {/* 当前状态显示 */}
      <Text style={styles.currentState}>
        当前状态: {currentState}
      </Text>

      {/* 动画容器 */}
      <View style={styles.animationContainer}>
        {getAnimationSource(currentState) ? (
          <LottieView
            key={currentState} // 添加 key 确保组件重新渲染
            ref={animationRef}
            source={getAnimationSource(currentState)}
            autoPlay={true}
            loop={true}
            style={styles.animation}
            onAnimationFinish={handleAnimationFinish}
            onAnimationLoaded={() => console.log(`${currentState} animation loaded`)}
            speed={1}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              {currentState} 动画文件未找到
            </Text>
          </View>
        )}
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

      {/* 动画控制按钮 */}
      <View style={styles.controlContainer}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => animationRef.current?.play()}
        >
          <Text style={styles.controlButtonText}>播放</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => animationRef.current?.pause()}
        >
          <Text style={styles.controlButtonText}>暂停</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => animationRef.current?.reset()}
        >
          <Text style={styles.controlButtonText}>重置</Text>
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
  animation: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
  },
  placeholderText: {
    color: '#999',
    textAlign: 'center',
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
  controlContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  controlButton: {
    backgroundColor: '#8E8E93',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 12,
  },
});

export default LottieTest;