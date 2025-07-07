import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, sizes } from '../constants';
import { requestCameraAndMicrophonePermissions, checkCameraAndMicrophonePermissions, PermissionStatus } from '../utils';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
};

type WelcomeScreenNavigationProp = StackNavigationProp<
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
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Welcome to EmoMate</Text>
        <Text style={styles.subtitle}>正在检查权限...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome to EmoMate</Text>
      <Text style={styles.subtitle}>Your emotional companion</Text>
      
      {!permissionStatus.allGranted && (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            请开启摄像头与麦克风权限以便与 AI 对话
          </Text>
          <View style={styles.permissionStatus}>
            <Text style={[styles.statusText, { color: permissionStatus.camera ? colors.success : colors.error }]}>
              摄像头: {permissionStatus.camera ? '已授权' : '未授权'}
            </Text>
            <Text style={[styles.statusText, { color: permissionStatus.microphone ? colors.success : colors.error }]}>
              麦克风: {permissionStatus.microphone ? '已授权' : '未授权'}
            </Text>
          </View>
        </View>
      )}
      
      <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
        <Text style={styles.buttonText}>
          {permissionStatus.allGranted ? 'Get Started' : '请求权限'}
        </Text>
      </TouchableOpacity>

    </SafeAreaView>
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
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: colors.gray,
    marginBottom: 48,
    textAlign: 'center',
  },
  permissionContainer: {
    backgroundColor: colors.white,
    padding: sizes.padding,
    borderRadius: sizes.borderRadius,
    marginBottom: 32,
    alignItems: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: colors.black,
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionStatus: {
    gap: 8,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: sizes.borderRadius,
    minWidth: 200,
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default WelcomeScreen;