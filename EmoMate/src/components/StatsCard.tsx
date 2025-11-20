import React from 'react';
import { View, Text } from 'react-native';

interface StatsCardProps {
  value: string | number;
  label: string;
  color?: 'blue' | 'green' | 'amber' | 'red';
  className?: string;
}

/**
 * Stats Card Component
 *
 * Reusable statistics display card with customizable color themes
 *
 * @param value - The statistic value to display
 * @param label - The label describing the statistic
 * @param color - Theme color for the value text (default: 'blue')
 * @param className - Additional CSS classes for customization
 *
 * @example
 * <StatsCard value={42} label="总场景数" color="blue" />
 * <StatsCard value="刚刚" label="最近识别" color="green" />
 */
const StatsCard: React.FC<StatsCardProps> = ({
  value,
  label,
  color = 'blue',
  className = '',
}) => {
  const colorClasses = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
  };

  return (
    <View
      className={`items-center flex-1 p-4 mx-1 bg-white shadow-sm rounded-xl ${className}`}
    >
      <Text className={`mb-1 text-xl font-bold ${colorClasses[color]}`}>
        {value}
      </Text>
      <Text className='text-xs font-medium text-gray-600'>{label}</Text>
    </View>
  );
};

export default StatsCard;
