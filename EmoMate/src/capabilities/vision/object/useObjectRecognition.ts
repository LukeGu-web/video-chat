/**
 * Object Recognition Hook
 * Manages storage and retrieval of object recognition records
 * Now uses Zustand store for state management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ObjectRecognitionRecord,
  ObjectRecognitionRequest,
  ObjectRecognitionResponse,
  AnalysisMode,
} from '../../../types/scene';
import { recognizeObjectWithClaude } from '../claudeVision';
import { useObjectRecognitionStore } from '../../../store/objectRecognitionStore';

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
  const store = useObjectRecognitionStore();

  // State for loading and error (not persisted)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Apply maxRecords configuration on mount
  useEffect(() => {
    if (config?.maxRecords && config.maxRecords !== store.maxRecords) {
      store.setMaxRecords(config.maxRecords);
    }
  }, [config?.maxRecords, store]);

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
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            imageBase64: imageToStore,
            data: response.object,
            createdAt: Date.now(),
          };

          // Add to store (will be persisted automatically)
          store.addRecord(newRecord);

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
    [apiKey, store]
  );

  /**
   * Delete a record by ID
   */
  const deleteRecord = useCallback(
    (recordId: string) => {
      store.deleteRecord(recordId);
      console.log(`[ObjectRecognition] Deleted record: ${recordId}`);
    },
    [store]
  );

  /**
   * Clear all records
   */
  const clearAllRecords = useCallback(() => {
    store.clearAllRecords();
    console.log('[ObjectRecognition] Cleared all records');
  }, [store]);

  /**
   * Get records by category
   */
  const getRecordsByCategory = useCallback(
    (category: string): ObjectRecognitionRecord[] => {
      return store.getRecordsByCategory(category);
    },
    [store]
  );

  /**
   * Search records by name or description
   */
  const searchRecords = useCallback(
    (query: string): ObjectRecognitionRecord[] => {
      return store.searchRecords(query);
    },
    [store]
  );

  /**
   * Get statistics
   */
  const getStats = useCallback(() => {
    return store.getStats();
  }, [store]);

  /**
   * Reload records from storage
   */
  const loadRecords = useCallback(() => {
    store.loadFromStorage();
    console.log('[ObjectRecognition] Reloaded records from storage');
  }, [store]);

  return {
    // State (from store and local)
    records: store.records,
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
