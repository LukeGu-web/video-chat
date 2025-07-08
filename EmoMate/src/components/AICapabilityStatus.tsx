import React from 'react';
import { View, Text } from 'react-native';
import { getAICapabilities, getCapabilityStatus } from '../constants/ai';

interface AICapabilityStatusProps {
  showDetails?: boolean;
}

const AICapabilityStatus: React.FC<AICapabilityStatusProps> = ({ 
  showDetails = false 
}) => {
  const capabilities = getAICapabilities();
  const status = getCapabilityStatus();

  if (!showDetails) {
    // 简化显示：只显示主要能力状态
    return (
      <View className="p-3 bg-gray-50 rounded-lg">
        <Text className="text-sm font-medium text-gray-700 mb-2">AI 能力状态</Text>
        <View className="flex-row flex-wrap gap-2">
          <View className={`px-2 py-1 rounded-full ${status.canChat ? 'bg-green-100' : 'bg-red-100'}`}>
            <Text className={`text-xs ${status.canChat ? 'text-green-700' : 'text-red-700'}`}>
              {status.canChat ? '✓ 对话' : '✗ 对话'}
            </Text>
          </View>
          <View className={`px-2 py-1 rounded-full ${status.canSpeak ? 'bg-green-100' : 'bg-red-100'}`}>
            <Text className={`text-xs ${status.canSpeak ? 'text-green-700' : 'text-red-700'}`}>
              {status.canSpeak ? '✓ 语音' : '✗ 语音'}
            </Text>
          </View>
          <View className={`px-2 py-1 rounded-full ${status.canListen ? 'bg-green-100' : 'bg-red-100'}`}>
            <Text className={`text-xs ${status.canListen ? 'text-green-700' : 'text-red-700'}`}>
              {status.canListen ? '✓ 听取' : '✗ 听取'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // 详细显示：显示所有能力详情
  return (
    <View className="p-4 bg-gray-50 rounded-lg">
      <Text className="text-lg font-bold text-gray-800 mb-3">
        AI 完整能力状态 ({status.availableCapabilities.length}/{status.totalCapabilities})
      </Text>
      
      {capabilities.map((capability, index) => (
        <View key={capability.id} className="mb-3">
          <View className="flex-row items-center justify-between mb-1">
            <Text className={`font-medium ${capability.isAvailable ? 'text-green-700' : 'text-red-700'}`}>
              {capability.isAvailable ? '✓' : '✗'} {capability.name}
            </Text>
            {capability.provider && (
              <Text className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                {capability.provider}
              </Text>
            )}
          </View>
          <Text className="text-sm text-gray-600">{capability.description}</Text>
        </View>
      ))}
    </View>
  );
};

export default AICapabilityStatus;