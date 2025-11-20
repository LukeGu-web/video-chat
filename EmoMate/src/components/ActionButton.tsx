import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

interface ActionButtonProps {
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'warning' | 'danger';
  className?: string;
}

/**
 * Action Button Component
 *
 * Reusable button for primary actions with disabled state support
 *
 * @param label - Button label text
 * @param icon - Optional emoji icon to display before label
 * @param onPress - Callback when button is pressed
 * @param disabled - Whether the button is disabled
 * @param variant - Button color variant (primary/warning/danger)
 * @param className - Additional CSS classes for customization
 *
 * @example
 * <ActionButton
 *   label="清理过期场景"
 *   icon="🗑️"
 *   variant="warning"
 *   onPress={handleClearExpired}
 *   disabled={expiredScenes.length === 0}
 * />
 */
const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  onPress,
  disabled = false,
  variant = 'primary',
  className = '',
}) => {
  const variantClasses = {
    primary: 'bg-blue-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  };

  return (
    <TouchableOpacity
      className={`flex-1 py-3 px-4 rounded-xl mx-1 items-center ${
        disabled ? 'bg-gray-300 opacity-50' : variantClasses[variant]
      } ${className}`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text className='text-sm font-semibold text-white'>
        {icon && `${icon} `}
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default ActionButton;
