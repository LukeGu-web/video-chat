import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  requestCameraAndMicrophonePermissions,
  checkCameraAndMicrophonePermissions,
  PermissionStatus,
} from '../utils';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
};

type WelcomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Welcome'
>;

interface Props {
  navigation: WelcomeScreenNavigationProp;
}

const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    camera: false,
    microphone: false,
    allGranted: false,
  });
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    setIsCheckingPermissions(true);
    const status = await checkCameraAndMicrophonePermissions();
    setPermissionStatus(status);
    setIsCheckingPermissions(false);
  };

  const requestPermissions = async () => {
    const status = await requestCameraAndMicrophonePermissions();
    setPermissionStatus(status);

    if (!status.allGranted) {
      Alert.alert(
        '权限需求',
        '请在设置中开启摄像头与麦克风权限以便与 AI 对话',
        [{ text: '确定', onPress: () => {} }]
      );
    }
  };

  const handleGetStarted = () => {
    if (permissionStatus.allGranted) {
      navigation.navigate('Home');
    } else {
      requestPermissions();
    }
  };

  if (isCheckingPermissions) {
    return (
      <SafeAreaView className='items-center justify-center flex-1 px-4 bg-background'>
        <Text className='mb-4 text-4xl font-bold text-center text-primary'>
          Welcome to EmoMate
        </Text>
        <Text className='mb-12 text-lg text-center text-gray-500'>
          正在检查权限...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className='items-center justify-center flex-1 px-4 bg-background'>
      <Text className='mb-4 text-4xl font-bold text-center text-primary'>
        Welcome to EmoMate
      </Text>
      <Text className='mb-12 text-lg text-center text-gray-500'>
        Your emotional companion
      </Text>

      {!permissionStatus.allGranted && (
        <View className='items-center p-4 mb-8 bg-white rounded-lg'>
          <Text className='mb-4 text-base text-center text-black'>
            请开启摄像头与麦克风权限以便与 AI 对话
          </Text>
          <View className='items-center gap-2'>
            <Text
              className={`text-sm font-medium ${
                permissionStatus.camera ? 'text-green-600' : 'text-red-600'
              }`}
            >
              摄像头: {permissionStatus.camera ? '已授权' : '未授权'}
            </Text>
            <Text
              className={`text-sm font-medium ${
                permissionStatus.microphone ? 'text-green-600' : 'text-red-600'
              }`}
            >
              麦克风: {permissionStatus.microphone ? '已授权' : '未授权'}
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        className='bg-primary px-8 py-4 rounded-lg min-w-[200px]'
        onPress={handleGetStarted}
      >
        <Text className='text-lg font-semibold text-center text-white'>
          {permissionStatus.allGranted ? 'Get Started' : '请求权限'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default WelcomeScreen;
