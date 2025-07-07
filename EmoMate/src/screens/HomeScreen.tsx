import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, sizes } from '../constants';
import { useUserStore } from '../store';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Home'
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { selectedCharacter, setSelectedCharacter, addEmotionLog } = useUserStore();

  useEffect(() => {
    console.log('Current selectedCharacter:', selectedCharacter);
    
    // 示例：设置一个默认角色
    if (!selectedCharacter) {
      setSelectedCharacter('默认AI伴侣');
    }
    
    // 示例：添加一个情绪日志
    addEmotionLog({
      date: new Date().toISOString().split('T')[0],
      emotion: '开心'
    });
  }, [selectedCharacter, setSelectedCharacter, addEmotionLog]);

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.subtitle}>Welcome to EmoMate!</Text>
      <Text style={styles.characterText}>
        当前 AI 伴侣: {selectedCharacter || '未选择'}
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleGoBack}>
        <Text style={styles.buttonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sizes.padding,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    marginBottom: 16,
    textAlign: 'center',
  },
  characterText: {
    fontSize: 18,
    color: colors.black,
    marginBottom: 32,
    textAlign: 'center',
    fontWeight: '500',
  },
  button: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: sizes.borderRadius,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default HomeScreen;