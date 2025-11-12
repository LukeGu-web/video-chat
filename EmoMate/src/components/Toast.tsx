import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';

interface ToastProps {
  message?: string;
  isVisible?: boolean;
  onDismiss?: () => void;
  duration?: number;
  type?: 'error' | 'success'; // Add type support
}

const Toast: React.FC<ToastProps> = ({
  message = 'An error occurred',
  isVisible = false,
  onDismiss,
  duration = 4000,
  type = 'error',
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // 显示动画
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // 自动隐藏
      const timer = setTimeout(() => {
        if (onDismiss) {
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -100,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onDismiss();
          });
        }
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, translateY, opacity, duration, onDismiss]);

  const hideToast = () => {
    if (onDismiss) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss();
      });
    }
  };

  if (!isVisible) return null;

  // Determine styles and icon based on type
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const icon = type === 'success' ? '✅' : '❌';

  return (
    <Animated.View
      className='absolute z-50 top-12 left-4 right-4'
      style={{
        transform: [{ translateY }],
        opacity,
      }}
    >
      <View className={`${bgColor} rounded-lg p-4 mx-4 shadow-lg`}>
        <View className='flex-row items-center justify-between'>
          <View className='flex-row items-center flex-1'>
            <Text className='mr-2 text-lg text-white'>{icon}</Text>
            <Text className='flex-1 font-medium text-white' numberOfLines={2}>
              {message}
            </Text>
          </View>
          <TouchableOpacity onPress={hideToast} className='p-1 ml-3'>
            <Text className='text-lg font-bold text-white'>×</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

export default Toast;
