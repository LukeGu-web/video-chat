import React from 'react';
import { View, Text } from 'react-native';

interface ObjectTagProps {
  name: string;
}

/**
 * Object Tag Component
 *
 * Displays a detected object as a styled tag/badge
 *
 * @param name - Object name or count (e.g., "cup", "+5")
 *
 * @example
 * <ObjectTag name="杯子" />
 * <ObjectTag name="+5" />
 */
const ObjectTag: React.FC<ObjectTagProps> = ({ name }) => {
  return (
    <View className='bg-blue-50 rounded-md px-3 py-1 mr-1.5 mb-1.5'>
      <Text className='text-xs font-medium text-blue-900'>{name}</Text>
    </View>
  );
};

export default ObjectTag;
