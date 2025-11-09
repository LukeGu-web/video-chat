import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { isDebugMode } from '../utils/debug';

interface HeaderProps {
  characterName?: string;
  onGoBack?: () => void;
  onGoToChatHistory?: () => void;
  onGoToSceneHistory?: () => void;
  onGoToEmotionTest?: () => void;
  onGoToEnvironmentTest?: () => void;
}

interface MenuOption {
  id: string;
  label: string;
  onPress: () => void;
  icon: string;
}

const Header: React.FC<HeaderProps> = ({
  characterName = 'AI伴侣',
  onGoBack,
  onGoToChatHistory,
  onGoToSceneHistory,
  onGoToEmotionTest,
  onGoToEnvironmentTest,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const menuOptions: MenuOption[] = [
    {
      id: 'chatHistory',
      label: '聊天记录',
      icon: '💬',
      onPress: () => {
        setIsModalVisible(false);
        onGoToChatHistory?.();
      },
    },
    {
      id: 'sceneHistory',
      label: '场景历史',
      icon: '📸',
      onPress: () => {
        setIsModalVisible(false);
        onGoToSceneHistory?.();
      },
    },
    ...(isDebugMode() && onGoToEmotionTest
      ? [
          {
            id: 'emotionTest',
            label: '情绪测试',
            icon: '🧪',
            onPress: () => {
              setIsModalVisible(false);
              onGoToEmotionTest?.();
            },
          },
          {
            id: 'environmentTest',
            label: '环境测试',
            icon: '🌳',
            onPress: () => {
              setIsModalVisible(false);
              onGoToEnvironmentTest?.();
            },
          },
        ]
      : []),
  ];

  const handleSettingsPress = () => {
    setIsModalVisible(true);
  };

  const hideModal = () => {
    setIsModalVisible(false);
  };

  return (
    <>
      <View className='flex-row items-center justify-end'>
        {/* Settings button */}
        <TouchableOpacity
          onPress={handleSettingsPress}
          className='items-center justify-center w-10 h-10 mr-4 rounded-full opacity-60'
        >
          <Text className='text-3xl'>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Full-screen settings modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType='fade'
        onRequestClose={hideModal}
      >
        <Pressable
          className='items-center justify-center flex-1'
          onPress={hideModal}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <View
            className='bg-white rounded-3xl w-[85%] max-w-[400px] overflow-hidden'
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Modal header */}
            <View className='items-center pt-6 pb-4 border-b border-gray-100'>
              <Text className='text-2xl font-bold text-gray-800'>设置</Text>
            </View>

            {/* Menu list */}
            <View className='py-2'>
              {menuOptions.map((option, index) => (
                <TouchableOpacity
                  key={option.id}
                  className='flex-row items-center px-6 py-4 active:bg-gray-50'
                  onPress={option.onPress}
                  style={{
                    borderTopWidth: index > 0 ? 1 : 0,
                    borderTopColor: '#f3f4f6',
                  }}
                >
                  <View className='items-center justify-center w-12 h-12 mr-4 bg-gray-100 rounded-2xl'>
                    <Text className='text-2xl'>{option.icon}</Text>
                  </View>
                  <Text className='flex-1 text-lg font-medium text-gray-800'>
                    {option.label}
                  </Text>
                  <Text className='text-xl text-gray-400'>›</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Close button */}
            <View className='px-6 py-4 border-t border-gray-100'>
              <TouchableOpacity
                className='items-center justify-center py-3 bg-gray-100 rounded-2xl active:bg-gray-200'
                onPress={hideModal}
              >
                <Text className='text-base font-semibold text-gray-700'>
                  关闭
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

export default Header;
