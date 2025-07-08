import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';

interface ErrorToastProps {
  message?: string;
  isVisible?: boolean;
  onDismiss?: () => void;
  duration?: number;
}

const ErrorToast: React.FC<ErrorToastProps> = ({
  message = 'An error occurred',
  isVisible = false,
  onDismiss,
  duration = 4000
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

  return (
    <Animated.View
      className="absolute top-12 left-4 right-4 z-50"
      style={{
        transform: [{ translateY }],
        opacity,
      }}
    >
      <View className="bg-red-500 rounded-lg p-4 mx-4 shadow-lg">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Text className="text-white text-lg mr-2">❌</Text>
            <Text className="text-white font-medium flex-1" numberOfLines={2}>
              {message}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={hideToast}
            className="ml-3 p-1"
          >
            <Text className="text-white text-lg font-bold">×</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

export default ErrorToast;