import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface TabButtonProps {
  label: string;
  isActive: boolean;
  count?: number;
  onPress: () => void;
}

/**
 * Tab Button Component
 *
 * Navigation tab with optional badge counter and active state styling
 *
 * @param label - The tab label text
 * @param isActive - Whether this tab is currently active
 * @param count - Optional badge count to display
 * @param onPress - Callback when tab is pressed
 *
 * @example
 * <TabButton
 *   label="场景历史"
 *   isActive={activeTab === 'scene'}
 *   count={10}
 *   onPress={() => setActiveTab('scene')}
 * />
 */
const TabButton: React.FC<TabButtonProps> = ({
  label,
  isActive,
  count,
  onPress,
}) => {
  return (
    <TouchableOpacity
      className={`flex-1 py-4 items-center justify-center flex-row border-b-2 ${
        isActive ? 'border-blue-500' : 'border-transparent'
      }`}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Text
        className={`text-base font-semibold ${
          isActive ? 'text-blue-500' : 'text-gray-400'
        }`}
      >
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View className='bg-blue-500 rounded-full px-2 py-0.5 ml-2 min-w-[20px] items-center'>
          <Text className='text-xs font-bold text-white'>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default TabButton;
