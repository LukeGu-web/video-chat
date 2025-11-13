/**
 * Object Recognition Hook
 * Manages storage and retrieval of object recognition records
 */

import { useState, useEffect, useCallback } from 'react';
import { createMMKV } from 'react-native-mmkv';
import {
  ObjectRecognitionRecord,
  ObjectRecognitionRequest,
  ObjectRecognitionResponse,
  AnalysisMode,
} from '../types/scene';
import { recognizeObjectWithClaude } from '../capabilities/vision/claudeVision';

/**
 * MMKV Storage instance for object recognition records
 */
const storage = createMMKV({
  id: 'object-recognition-storage',
  encryptionKey: 'object-recognition-encryption-key',
});

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  RECORDS: 'object-recognition-records',
};

/**
 * Maximum number of records to store
 */
const MAX_RECORDS = 50;

/**
 * Object Recognition Hook Configuration
 */
export interface ObjectRecognitionConfig {
  /** Maximum number of records to keep */
  maxRecords?: number;
}

/**
 * Object Recognition Hook
 * Provides methods to recognize objects and manage recognition history
 */
export function useObjectRecognition(
  apiKey: string,
  config?: ObjectRecognitionConfig
) {
  const maxRecords = config?.maxRecords || MAX_RECORDS;

  // State for records
  const [records, setRecords] = useState<ObjectRecognitionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load records from storage
   */
  const loadRecords = useCallback(() => {
    try {
      const storedRecords = storage.getString(STORAGE_KEYS.RECORDS);
      if (storedRecords) {
        const parsed = JSON.parse(storedRecords) as ObjectRecognitionRecord[];
        // Sort by createdAt descending (newest first)
        parsed.sort((a, b) => b.createdAt - a.createdAt);
        setRecords(parsed);
        console.log(
          `[ObjectRecognition] Loaded ${parsed.length} records from storage`
        );
      } else {
        setRecords([]);
        console.log('[ObjectRecognition] No stored records found');
      }
    } catch (err) {
      console.error('[ObjectRecognition] Failed to load records:', err);
      setRecords([]);
    }
  }, []);

  /**
   * Save records to storage
   */
  const saveRecords = useCallback(
    (newRecords: ObjectRecognitionRecord[]) => {
      try {
        // Keep only maxRecords newest records
        const recordsToSave = newRecords.slice(0, maxRecords);
        storage.set(STORAGE_KEYS.RECORDS, JSON.stringify(recordsToSave));
        setRecords(recordsToSave);
        console.log(
          `[ObjectRecognition] Saved ${recordsToSave.length} records to storage`
        );
      } catch (err) {
        console.error('[ObjectRecognition] Failed to save records:', err);
        setError('保存记录失败');
      }
    },
    [maxRecords]
  );

  /**
   * Recognize an object and save the result
   */
  const recognizeObject = useCallback(
    async (
      imageBase64: string,
      userPrompt: string
    ): Promise<ObjectRecognitionResponse> => {
      if (!apiKey) {
        const errorMsg = 'API key not configured';
        setError(errorMsg);
        return {
          object: {
            objectName: '配置错误',
            category: '未知',
            description: '未配置 API Key',
            confidence: 0,
            timestamp: Date.now(),
          },
          success: false,
          error: errorMsg,
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        const request: ObjectRecognitionRequest = {
          imageBase64,
          userPrompt,
          mode: AnalysisMode.OBJECT,
        };

        // Call Claude Vision API
        const response = await recognizeObjectWithClaude(request, apiKey);

        // If successful, save the record
        if (response.success) {
          // Ensure imageBase64 has proper data URI format for storage
          const imageToStore = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:image/jpeg;base64,${imageBase64}`;

          // Log image format for debugging
          const imageSizeKB = Math.round((imageToStore.length * 0.75) / 1024);
          console.log('[ObjectRecognition] 📸 Preparing to save image:', {
            hasDataPrefix: imageToStore.startsWith('data:'),
            sizeKB: imageSizeKB,
            preview: imageToStore.substring(0, 50) + '...',
          });

          const newRecord: ObjectRecognitionRecord = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            imageBase64: imageToStore,
            data: response.object,
            createdAt: Date.now(),
          };

          // Add to records (newest first)
          const updatedRecords = [newRecord, ...records];
          saveRecords(updatedRecords);

          console.log('[ObjectRecognition] ✅ Object recognized and saved:', {
            id: newRecord.id,
            name: response.object.objectName,
            category: response.object.category,
            imageSizeKB,
          });
        }

        return response;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[ObjectRecognition] Recognition failed:', err);
        setError(errorMsg);

        return {
          object: {
            objectName: '识别失败',
            category: '未知',
            description: '识别过程中发生错误',
            confidence: 0,
            timestamp: Date.now(),
          },
          success: false,
          error: errorMsg,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, records, saveRecords]
  );

  /**
   * Delete a record by ID
   */
  const deleteRecord = useCallback(
    (recordId: string) => {
      const updatedRecords = records.filter((r) => r.id !== recordId);
      saveRecords(updatedRecords);
      console.log(`[ObjectRecognition] Deleted record: ${recordId}`);
    },
    [records, saveRecords]
  );

  /**
   * Clear all records
   */
  const clearAllRecords = useCallback(() => {
    storage.remove(STORAGE_KEYS.RECORDS);
    setRecords([]);
    console.log('[ObjectRecognition] Cleared all records');
  }, []);

  /**
   * Get records by category
   */
  const getRecordsByCategory = useCallback(
    (category: string): ObjectRecognitionRecord[] => {
      return records.filter(
        (r) => r.data.category.toLowerCase() === category.toLowerCase()
      );
    },
    [records]
  );

  /**
   * Search records by name or description
   */
  const searchRecords = useCallback(
    (query: string): ObjectRecognitionRecord[] => {
      const lowerQuery = query.toLowerCase();
      return records.filter(
        (r) =>
          r.data.objectName.toLowerCase().includes(lowerQuery) ||
          r.data.description.toLowerCase().includes(lowerQuery) ||
          r.data.brand?.toLowerCase().includes(lowerQuery)
      );
    },
    [records]
  );

  /**
   * Get statistics
   */
  const getStats = useCallback(() => {
    const categories = new Map<string, number>();
    records.forEach((r) => {
      const category = r.data.category;
      categories.set(category, (categories.get(category) || 0) + 1);
    });

    return {
      totalRecords: records.length,
      categories: Array.from(categories.entries()).map(([name, count]) => ({
        name,
        count,
      })),
      latestRecord: records[0] || null,
    };
  }, [records]);

  // Load records on mount
  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  return {
    // State
    records,
    isLoading,
    error,

    // Actions
    recognizeObject,
    deleteRecord,
    clearAllRecords,

    // Query methods
    getRecordsByCategory,
    searchRecords,
    getStats,

    // Utility
    loadRecords,
  };
}
