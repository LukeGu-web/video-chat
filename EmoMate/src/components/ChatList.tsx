import React, { useRef, useEffect } from 'react';
import { View, Text, FlatList } from 'react-native';
import { ChatMessage } from '../store/userStore';
import { ChatBubble } from './ChatBubble';

interface ChatListProps {
  messages: ChatMessage[];
}

const ChatList: React.FC<ChatListProps> = ({ messages }) => {
  const flatListRef = useRef<FlatList>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <ChatBubble message={item} />
  );

  if (messages.length === 0) {
    return (
      <View>
        <Text className='text-center text-gray-500 mt-4'>没有记录任何消息</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingVertical: 8,
        flexGrow: 1,
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
