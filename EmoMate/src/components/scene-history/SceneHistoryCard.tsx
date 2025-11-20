import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import StatusBadge from './StatusBadge';
import ObjectTag from './ObjectTag';

// Import CachedSceneEntry type from vision capability
// Note: Adjust the import path based on your actual types location
interface CachedSceneEntry {
  scene: {
    location: string;
    objects: string[];
    atmosphere?: string;
  };
  cachedAt: number;
  expiresAt: number;
}

interface SceneHistoryCardProps {
  entry: CachedSceneEntry;
  index: number;
}

/**
 * Scene History Card Component
 *
 * Displays a cached scene analysis result with expiration status,
 * detected objects, and atmosphere information
 *
 * Features:
 * - Active/Expired status indicator
 * - Time information (cached time, expiration)
 * - Detected objects list with overflow handling
 * - Atmosphere description
 *
 * @param entry - Cached scene entry data
 * @param index - Entry index for display
 *
 * @example
 * <SceneHistoryCard entry={sceneEntry} index={0} />
 */
const SceneHistoryCard: React.FC<SceneHistoryCardProps> = ({
  entry,
  index,
}) => {
  // Calculate time-related values
  const timeInfo = useMemo(() => {
    const now = Date.now();
    const ageMinutes = Math.floor((now - entry.cachedAt) / 60000);
    const expiresInMinutes = Math.floor((entry.expiresAt - now) / 60000);
    const isExpired = entry.expiresAt <= now;
    const isActive = expiresInMinutes > 0;

    return {
      ageMinutes,
      expiresInMinutes,
      isExpired,
      isActive,
      ageText: ageMinutes < 1 ? '刚刚' : `${ageMinutes} 分钟前`,
      expiresText: isExpired ? '已过期' : `${expiresInMinutes} 分钟后`,
    };
  }, [entry.cachedAt, entry.expiresAt]);

  // Limit objects to display
  const MAX_VISIBLE_OBJECTS = 6;
  const visibleObjects = entry.scene.objects.slice(0, MAX_VISIBLE_OBJECTS);
  const remainingCount = entry.scene.objects.length - MAX_VISIBLE_OBJECTS;

  return (
    <View
      className={`bg-white rounded-xl p-4 mb-3 shadow-sm border-l-4 ${
        timeInfo.isExpired ? 'border-gray-400 opacity-70' : 'border-blue-500'
      }`}
    >
      {/* Header */}
      <View className='flex-row items-center justify-between mb-3'>
        <View className='flex-row items-center flex-1'>
          <Text className='mr-2 text-sm font-bold text-gray-600'>
            #{index + 1}
          </Text>
          <Text className='flex-1 text-base font-semibold text-gray-800'>
            {entry.scene.location}
          </Text>
        </View>
        <StatusBadge isActive={timeInfo.isActive} />
      </View>

      {/* Time Info */}
      <View className='flex-row justify-between pb-3 mb-3 border-b border-gray-100'>
        <View className='flex-1'>
          <Text className='text-xs text-gray-400 mb-0.5'>缓存于</Text>
          <Text className='text-sm font-medium text-gray-700'>
            {timeInfo.ageText}
          </Text>
        </View>
        <View className='flex-1'>
          <Text className='text-xs text-gray-400 mb-0.5'>过期</Text>
          <Text
            className={`text-sm font-medium ${
              timeInfo.isExpired ? 'text-red-600' : 'text-gray-700'
            }`}
          >
            {timeInfo.expiresText}
          </Text>
        </View>
      </View>

      {/* Objects */}
      {entry.scene.objects.length > 0 && (
        <View className='mb-3'>
          <Text className='mb-2 text-xs font-semibold text-gray-600'>
            检测到的物品 ({entry.scene.objects.length})
          </Text>
          <View className='flex-row flex-wrap'>
            {visibleObjects.map((obj, objIdx) => (
              <ObjectTag key={objIdx} name={obj} />
            ))}
            {remainingCount > 0 && <ObjectTag name={`+${remainingCount}`} />}
          </View>
        </View>
      )}

      {/* Atmosphere */}
      {entry.scene.atmosphere && (
        <View className='mt-2'>
          <Text className='mb-1 text-xs text-gray-400'>氛围</Text>
          <Text className='text-sm leading-5 text-gray-700' numberOfLines={2}>
            {entry.scene.atmosphere}
          </Text>
        </View>
      )}
    </View>
  );
};

export default SceneHistoryCard;
