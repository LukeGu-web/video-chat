import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';

interface ObjectRecognitionData {
  objectName: string;
  category: string;
  description: string;
  brand?: string;
  model?: string;
  color?: string;
  priceRange?: string;
  userPrompt?: string;
  confidence: number;
}

interface ObjectRecognitionRecord {
  id: string;
  imageBase64: string;
  data: ObjectRecognitionData;
  createdAt: number;
}

interface ObjectRecognitionCardProps {
  record: ObjectRecognitionRecord;
  onDelete: (id: string) => void;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

/**
 * Object Recognition Card Component
 *
 * Displays a single object recognition record with:
 * - Thumbnail image with fallback placeholder
 * - Object name, category, and timestamp
 * - Expandable/collapsible description
 * - Optional details (brand, model, color, price)
 * - User prompt and confidence score
 * - Delete action button
 *
 * @param record - Object recognition record data
 * @param onDelete - Callback when delete button is pressed
 * @param isExpanded - Whether description is expanded
 * @param onToggleExpand - Callback to toggle description expansion
 *
 * @example
 * <ObjectRecognitionCard
 *   record={recognitionRecord}
 *   onDelete={handleDelete}
 *   isExpanded={expandedIds.has(record.id)}
 *   onToggleExpand={toggleExpand}
 * />
 */
const ObjectRecognitionCard: React.FC<ObjectRecognitionCardProps> = ({
  record,
  onDelete,
  isExpanded,
  onToggleExpand,
}) => {
  // Calculate age text
  const ageText = useMemo(() => {
    const ageMinutes = Math.floor((Date.now() - record.createdAt) / 60000);
    const ageHours = Math.floor(ageMinutes / 60);
    const ageDays = Math.floor(ageHours / 24);

    return ageDays > 0
      ? `${ageDays}天前`
      : ageHours > 0
      ? `${ageHours}小时前`
      : ageMinutes < 1
      ? '刚刚'
      : `${ageMinutes}分钟前`;
  }, [record.createdAt]);

  // Ensure proper data URI format
  const imageUri = useMemo(() => {
    return record.imageBase64.startsWith('data:')
      ? record.imageBase64
      : `data:image/jpeg;base64,${record.imageBase64}`;
  }, [record.imageBase64]);

  const needsToggle = record.data.description.length > 100;
  const hasDetails =
    record.data.brand ||
    record.data.model ||
    record.data.color ||
    record.data.priceRange;

  return (
    <View className='p-4 mb-3 bg-white border-l-4 border-green-500 shadow-sm rounded-xl'>
      {/* Header with image and basic info */}
      <View className='flex-row mb-3'>
        {/* Thumbnail */}
        <View className='relative w-20 h-20'>
          <Image
            source={{ uri: imageUri }}
            className='w-20 h-20 bg-gray-100 rounded-lg'
            resizeMode='cover'
            onError={(error) => {
              console.error(
                '[ObjectRecognitionCard] Image load error:',
                error.nativeEvent
              );
            }}
          />
          {/* Fallback placeholder overlay */}
          <View className='absolute top-0 bottom-0 left-0 right-0 items-center justify-center bg-gray-200 rounded-lg -z-10'>
            <Text className='text-3xl opacity-50'>📷</Text>
          </View>
        </View>

        {/* Basic info */}
        <View className='justify-center flex-1 ml-3'>
          <Text
            className='text-base font-bold text-gray-800 mb-1.5'
            numberOfLines={2}
          >
            {record.data.objectName}
          </Text>
          <View className='flex-row items-center'>
            <View className='bg-green-100 rounded-md px-2 py-0.5 mr-2'>
              <Text className='text-xs font-semibold text-green-800'>
                {record.data.category}
              </Text>
            </View>
            <Text className='text-xs text-gray-400'>{ageText}</Text>
          </View>
        </View>

        {/* Delete button */}
        <TouchableOpacity
          className='items-center justify-center w-8 h-8 bg-red-100 rounded-full'
          onPress={() => onDelete(record.id)}
        >
          <Text className='text-lg font-semibold text-red-600'>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Description with expand/collapse */}
      <View className='mb-3'>
        <Text
          className='text-sm leading-5 text-gray-700'
          numberOfLines={isExpanded ? undefined : 3}
        >
          {record.data.description}
        </Text>
        {needsToggle && (
          <TouchableOpacity
            onPress={() => onToggleExpand(record.id)}
            className='mt-1'
          >
            <Text className='text-xs font-semibold text-blue-500'>
              {isExpanded ? '收起 ▲' : '展开 ▼'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Details */}
      {hasDetails && (
        <View className='flex-row flex-wrap mb-3'>
          {record.data.brand && (
            <View className='flex-row mr-4 mb-1.5'>
              <Text className='mr-1 text-xs text-gray-400'>品牌</Text>
              <Text className='text-xs font-medium text-gray-700'>
                {record.data.brand}
              </Text>
            </View>
          )}
          {record.data.model && (
            <View className='flex-row mr-4 mb-1.5'>
              <Text className='mr-1 text-xs text-gray-400'>型号</Text>
              <Text className='text-xs font-medium text-gray-700'>
                {record.data.model}
              </Text>
            </View>
          )}
          {record.data.color && (
            <View className='flex-row mr-4 mb-1.5'>
              <Text className='mr-1 text-xs text-gray-400'>颜色</Text>
              <Text className='text-xs font-medium text-gray-700'>
                {record.data.color}
              </Text>
            </View>
          )}
          {record.data.priceRange && (
            <View className='flex-row mr-4 mb-1.5'>
              <Text className='mr-1 text-xs text-gray-400'>参考价格</Text>
              <Text className='text-xs font-medium text-gray-700'>
                {record.data.priceRange}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Footer with user prompt and confidence */}
      <View className='flex-row items-center justify-between pt-3 border-t border-gray-100'>
        {record.data.userPrompt && (
          <Text
            className='flex-1 mr-2 text-xs italic text-gray-600'
            numberOfLines={1}
          >
            "{record.data.userPrompt}"
          </Text>
        )}
        <View className='px-3 py-1 bg-blue-50 rounded-xl'>
          <Text className='text-xs font-semibold text-blue-900'>
            置信度 {(record.data.confidence * 100).toFixed(0)}%
          </Text>
        </View>
      </View>
    </View>
  );
};

export default ObjectRecognitionCard;
