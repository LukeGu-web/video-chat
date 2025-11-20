import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUserStore } from '../store';
import { ChatList } from '../components';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  ChatHistory: undefined;
};

type ChatHistoryScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ChatHistory'
>;

const ChatHistoryScreen: React.FC = () => {
  const navigation = useNavigation<ChatHistoryScreenNavigationProp>();
  const { chatHistory, clearChatHistory } = useUserStore();

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleClearHistory = () => {
    clearChatHistory();
  };

  return (
    <SafeAreaView className='flex-1 bg-background'>
      {/* Header with Back Button */}
      <View className='bg-white border-b border-gray-200'>
        <View className='flex-row items-center justify-between p-4'>
          <Pressable onPress={handleGoBack} className='flex-row items-center'>
            <Text className='font-medium text-blue-500 text-16'>← 返回</Text>
          </Pressable>

          <Text className='text-lg font-bold text-gray-800'>聊天记录</Text>

          <Pressable
            onPress={handleClearHistory}
            className='px-3 py-1 bg-red-500 rounded-lg'
          >
            <Text className='text-sm font-medium text-white'>清空</Text>
          </Pressable>
        </View>
      </View>

      {/* Chat History Content */}
      <View className='flex-1'>
        <ChatList messages={chatHistory} />
      </View>

      {/* Message Count Footer */}
      <View className='px-4 py-3 bg-white border-t border-gray-200'>
        <Text className='text-sm text-center text-gray-500'>
          共 {chatHistory.length} 条消息
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default ChatHistoryScreen;
