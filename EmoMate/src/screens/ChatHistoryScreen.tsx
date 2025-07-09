import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { useUserStore } from '../store';
import { ChatList } from '../components';

type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  ChatHistory: undefined;
};

type ChatHistoryScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChatHistory'>;

interface Props {
  navigation: ChatHistoryScreenNavigationProp;
}

const ChatHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { chatHistory, selectedCharacter } = useUserStore();

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header with Back Button */}
      <View className="bg-white border-b border-gray-200">
        <View className="flex-row items-center justify-between p-4">
          <TouchableOpacity
            onPress={handleGoBack}
            className="flex-row items-center"
          >
            <Text className="text-blue-500 text-16 font-medium">← 返回</Text>
          </TouchableOpacity>
          
          <Text className="text-lg font-bold text-gray-800">
            聊天记录
          </Text>
          
          <View className="w-16" />
        </View>
        
        {/* Character Info */}
        <View className="px-4 pb-3">
          <Text className="text-sm text-gray-600">
            与 {selectedCharacter || 'AI伴侣'} 的对话
          </Text>
        </View>
      </View>

      {/* Chat History Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <ChatList
          messages={chatHistory}
          isLoading={false}
          isListening={false}
          characterName={selectedCharacter || 'AI'}
          showTyping={false}
          showListening={false}
        />
      </ScrollView>

      {/* Message Count Footer */}
      <View className="bg-white border-t border-gray-200 px-4 py-3">
        <Text className="text-center text-sm text-gray-500">
          共 {chatHistory.length} 条消息
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default ChatHistoryScreen;