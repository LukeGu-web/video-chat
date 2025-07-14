import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
} from 'react-native';

interface HeaderProps {
  characterName?: string;
  onGoBack?: () => void;
  onGoToChatHistory?: () => void;
}

interface DropdownOption {
  id: string;
  label: string;
  onPress: () => void;
  icon?: string;
}

const Header: React.FC<HeaderProps> = ({
  characterName = 'AI伴侣',
  onGoBack,
  onGoToChatHistory,
}) => {
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const settingsButtonRef = useRef<View>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const dropdownOptions: DropdownOption[] = [
    {
      id: 'chatHistory',
      label: '聊天记录',
      icon: '💬',
      onPress: () => {
        setIsDropdownVisible(false);
        onGoToChatHistory?.();
      },
    },
  ];

  const handleSettingsPress = () => {
    settingsButtonRef.current?.measure(
      (_x, _y, _width, height, pageX, pageY) => {
        setDropdownPosition({
          x: pageX - 120, // 调整位置让下拉菜单在按钮左边
          y: pageY + height + 8,
        });
        setIsDropdownVisible(true);

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    );
  };

  const hideDropdown = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setIsDropdownVisible(false);
    });
  };

  return (
    <>
      {/* Header */}

      <View className='flex-row items-center justify-end'>
        {/* 右侧设置按钮 */}
        <View ref={settingsButtonRef} collapsable={false}>
          <TouchableOpacity
            onPress={handleSettingsPress}
            className='items-center justify-center w-10 h-10 mr-6 rounded-full'
          >
            <Text className='text-3xl'>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 下拉菜单 Modal */}
      <Modal
        visible={isDropdownVisible}
        transparent={true}
        animationType='none'
        onRequestClose={hideDropdown}
      >
        <Pressable className='flex-1 bg-black/10' onPress={hideDropdown}>
          <Animated.View
            className='absolute bg-white rounded-xl min-w-[160px] py-2 shadow-lg border border-gray-200'
            style={{
              opacity: fadeAnim,
              transform: [
                {
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
              left: dropdownPosition.x,
              top: dropdownPosition.y,
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {dropdownOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                className='flex-row items-center px-4 py-3'
                onPress={option.onPress}
              >
                <Text className='mr-3 text-base'>{option.icon}</Text>
                <Text className='text-base font-medium text-gray-700'>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
};

export default Header;
