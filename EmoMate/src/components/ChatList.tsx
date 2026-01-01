import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { ChatMessage } from '../store/chatStore';
import { ChatBubble } from './ChatBubble';
import { formatDateSeparator, isSameDay } from '../utils/timeFormat';

interface ChatListProps {
  messages: ChatMessage[];
}

// List item type: either a message or a date separator
type ListItem =
  | { type: 'message'; data: ChatMessage }
  | { type: 'separator'; data: { id: string; date: string; timestamp: number } };

// Date separator component (like WeChat)
const DateSeparator: React.FC<{ date: string }> = ({ date }) => (
  <View className='items-center my-2'>
    <View className='bg-gray-200 px-3 py-1 rounded-full'>
      <Text className='text-xs text-gray-600'>{date}</Text>
    </View>
  </View>
);

const ChatList: React.FC<ChatListProps> = ({ messages }) => {
  const flatListRef = useRef<FlatList>(null);

  // Group messages by date and insert date separators
  const listItems = useMemo(() => {
    const items: ListItem[] = [];
    let lastDate: number | null = null;

    messages.forEach((message) => {
      // Insert date separator if this is the first message or different day
      if (lastDate === null || !isSameDay(lastDate, message.timestamp)) {
        items.push({
          type: 'separator',
          data: {
            id: `separator-${message.timestamp}`,
            date: formatDateSeparator(message.timestamp),
            timestamp: message.timestamp,
          },
        });
        lastDate = message.timestamp;
      }

      // Add the message
      items.push({
        type: 'message',
        data: message,
      });
    });

    return items;
  }, [messages]);

  // 自动滚动到底部
  useEffect(() => {
    if (listItems.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [listItems.length]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'separator') {
      return <DateSeparator date={item.data.date} />;
    }
    return <ChatBubble message={item.data} />;
  };

  const keyExtractor = (item: ListItem) => {
    if (item.type === 'separator') {
      return item.data.id;
    }
    return item.data.id;
  };

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
      data={listItems}
      keyExtractor={keyExtractor}
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
        if (listItems.length > 0) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }}
    />
  );
};

export default ChatList;
