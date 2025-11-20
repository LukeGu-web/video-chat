import React from 'react';
import { View, Text } from 'react-native';

interface StatusBadgeProps {
  isActive: boolean;
}

/**
 * Status Badge Component
 *
 * Displays active/expired status indicator for scene history entries
 *
 * @param isActive - Whether the scene is still active (not expired)
 *
 * @example
 * <StatusBadge isActive={expiresInMinutes > 0} />
 */
const StatusBadge: React.FC<StatusBadgeProps> = ({ isActive }) => {
  return (
    <View
      className={`px-3 py-1 rounded-xl ${
        isActive ? 'bg-green-100' : 'bg-red-100'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          isActive ? 'text-green-800' : 'text-red-800'
        }`}
      >
        {isActive ? '✓ 活跃' : '✗ 已过期'}
      </Text>
    </View>
  );
};

export default StatusBadge;
