import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface ListeningIndicatorProps {
  isVisible?: boolean;
}

const ListeningIndicator: React.FC<ListeningIndicatorProps> = ({ 
  isVisible = true 
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // 脉冲动画
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // 发光动画
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isVisible, pulseAnim, glowAnim]);

  if (!isVisible) return null;

  return (
    <View className="items-center justify-center py-4">
      {/* 发光外圈 */}
      <Animated.View
        className="absolute w-24 h-24 rounded-full bg-blue-400"
        style={{
          opacity: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.2, 0.4],
          }),
          transform: [
            {
              scale: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.3],
              }),
            },
          ],
        }}
      />
      
      {/* 主圆圈 */}
      <Animated.View
        className="w-20 h-20 rounded-full bg-blue-500 items-center justify-center"
        style={{
          transform: [{ scale: pulseAnim }],
        }}
      >
        <Text className="text-white text-2xl">🎤</Text>
      </Animated.View>
      
      {/* 文字 */}
      <Text className="text-blue-600 font-medium mt-3">Listening...</Text>
    </View>
  );
};

export default ListeningIndicator;