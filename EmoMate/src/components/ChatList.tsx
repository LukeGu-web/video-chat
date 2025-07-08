import React, { useRef, useEffect } from 'react';
import { View, Text, FlatList, FlatListProps } from 'react-native';
import { ChatMessage } from '../store/userStore';
import { ChatBubble } from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import VoiceWaveAnimation from './VoiceWaveAnimation';

interface ChatListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  isListening?: boolean;
  characterName?: string;
  showTyping?: boolean;
  showListening?: boolean;
}

const ChatList: React.FC<ChatListProps> = ({
  messages,
  isLoading = false,
  isListening = false,
  characterName = 'AI',
  showTyping = true,
  showListening = true
}) => {
  const flatListRef = useRef<FlatList>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isLoading]);

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <ChatBubble message={item} />
  );

  const renderEmptyComponent = () => (
    <View className="flex-1 justify-center items-center px-8">
      {isListening && showListening ? (
        <View className="items-center">
          <VoiceWaveAnimation isAnimating={true} />
          <Text className="text-blue-600 font-medium mt-4">正在听您说话...</Text>
        </View>
      ) : (
        <>
          <Text className="text-xl text-gray-600 text-center mb-4">
            👋 按住下方按钮开始语音对话
          </Text>
          <Text className="text-sm text-gray-500 text-center">
            说话后会自动识别并发送给AI，AI也会语音回复
          </Text>
        </>
      )}
    </View>
  );

  const renderFooter = () => (
    <>
      {/* Typing Indicator */}
      {isLoading && showTyping && (
        <TypingIndicator 
          isVisible={true} 
          characterName={characterName}
        />
      )}
      
      {/* Listening State in Chat */}
      {isListening && showListening && messages.length > 0 && (
        <View className="px-4 py-4 items-center">
          <VoiceWaveAnimation isAnimating={true} size={60} />
          <Text className="text-blue-600 font-medium mt-2">正在听您说话...</Text>
        </View>
      )}
    </>
  );

  if (messages.length === 0) {
    return renderEmptyComponent();
  }

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListFooterComponent={renderFooter}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ 
        paddingVertical: 8,
        flexGrow: 1
      }}
      onContentSizeChange={() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }}
      onLayout={() => {
        if (messages.length > 0) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }}
    />
  );
};

export default ChatList;