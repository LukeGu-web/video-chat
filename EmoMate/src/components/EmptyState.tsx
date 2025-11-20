import React from 'react';
import { View, Text } from 'react-native';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  className?: string;
}

/**
 * Empty State Component
 *
 * Displays a friendly message when no data is available
 *
 * @param icon - Emoji icon to display (e.g., "📭", "📦")
 * @param title - Main title text
 * @param description - Descriptive text explaining the empty state
 * @param className - Additional CSS classes for customization
 *
 * @example
 * <EmptyState
 *   icon="📭"
 *   title="暂无缓存场景"
 *   description="使用视觉问答功能后,场景分析结果会自动保存在这里"
 * />
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  className = '',
}) => {
  return (
    <View
      className={`items-center p-10 bg-white shadow-sm rounded-2xl ${className}`}
    >
      <Text className='mb-3 text-6xl'>{icon}</Text>
      <Text className='mb-2 text-base font-semibold text-gray-600'>
        {title}
      </Text>
      <Text className='text-sm leading-5 text-center text-gray-400'>
        {description}
      </Text>
    </View>
  );
};

export default EmptyState;
