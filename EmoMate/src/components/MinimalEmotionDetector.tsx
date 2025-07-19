import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 最小化组件 - 不包含任何复杂依赖
export const MinimalEmotionDetector: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Minimal Detector</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 100,
    height: 100,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 100,
    left: 20,
    borderRadius: 8,
  },
  text: {
    fontSize: 12,
    color: '#333',
  },
});