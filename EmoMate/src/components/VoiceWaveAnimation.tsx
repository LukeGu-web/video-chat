import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
// import Animated, {
//   useSharedValue,
//   useAnimatedStyle,
//   withRepeat,
//   withTiming,
//   interpolate,
// } from 'react-native-reanimated';

interface VoiceWaveAnimationProps {
  isAnimating?: boolean;
  size?: number;
  color?: string;
}

const VoiceWaveAnimation: React.FC<VoiceWaveAnimationProps> = ({
  isAnimating = true,
  size = 80,
  color = '#3B82F6'
}) => {
  // Using React Native's Animated API instead of Reanimated for now
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const scale3 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAnimating) {
      // 第一层波动
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale1, {
            toValue: 1.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scale1, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // 第二层波动（延迟200ms）
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(scale2, {
              toValue: 1.6,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(scale2, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }, 200);
      
      // 第三层波动（延迟400ms）
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(scale3, {
              toValue: 1.8,
              duration: 1400,
              useNativeDriver: true,
            }),
            Animated.timing(scale3, {
              toValue: 1,
              duration: 1400,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }, 400);
    } else {
      scale1.setValue(1);
      scale2.setValue(1);
      scale3.setValue(1);
    }
  }, [isAnimating, scale1, scale2, scale3]);

  return (
    <View className="items-center justify-center" style={{ width: size * 2, height: size * 2 }}>
      {/* 第三层（最外层）*/}
      <Animated.View
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          transform: [{ scale: scale3 }],
          opacity: 0.3,
        }}
      />
      
      {/* 第二层（中间层）*/}
      <Animated.View
        className="absolute rounded-full"
        style={{
          width: size * 0.8,
          height: size * 0.8,
          backgroundColor: color,
          transform: [{ scale: scale2 }],
          opacity: 0.5,
        }}
      />
      
      {/* 第一层（内层）*/}
      <Animated.View
        className="absolute rounded-full"
        style={{
          width: size * 0.6,
          height: size * 0.6,
          backgroundColor: color,
          transform: [{ scale: scale1 }],
          opacity: 0.7,
        }}
      />
      
      {/* 中心圆 */}
      <View
        className="rounded-full items-center justify-center"
        style={{
          width: size * 0.4,
          height: size * 0.4,
          backgroundColor: color,
        }}
      />
    </View>
  );
};

export default VoiceWaveAnimation;