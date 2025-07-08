import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

interface LoadingDotsProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

const LoadingDots: React.FC<LoadingDotsProps> = ({ 
  size = 'medium', 
  color = '#6B7280' 
}) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  const dotSize = size === 'small' ? 4 : size === 'medium' ? 6 : 8;
  const dotSizeClass = size === 'small' ? 'w-1 h-1' : size === 'medium' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  useEffect(() => {
    const duration = 600;
    const delay = 200;
    
    const animate = () => {
      Animated.sequence([
        Animated.timing(dot1, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(dot1, {
          toValue: 0,
          duration: duration,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot2, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(dot2, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ]).start();
      }, delay);

      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot3, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(dot3, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ]).start();
      }, delay * 2);
    };

    animate();
    const interval = setInterval(animate, duration * 2 + delay * 2);

    return () => clearInterval(interval);
  }, [dot1, dot2, dot3]);

  return (
    <View className="flex-row items-center justify-center space-x-1">
      <Animated.View
        className={`${dotSizeClass} rounded-full`}
        style={{
          backgroundColor: color,
          opacity: dot1,
        }}
      />
      <Animated.View
        className={`${dotSizeClass} rounded-full`}
        style={{
          backgroundColor: color,
          opacity: dot2,
        }}
      />
      <Animated.View
        className={`${dotSizeClass} rounded-full`}
        style={{
          backgroundColor: color,
          opacity: dot3,
        }}
      />
    </View>
  );
};

export default LoadingDots;