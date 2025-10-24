/**
 * File System Helper Utilities
 * Expo v54 filesystem API helpers for audio file operations
 */

import { File, Directory } from 'expo-file-system';

/**
 * Convert base64 string to Uint8Array for File.write()
 * Required for Expo v54 filesystem API
 *
 * @param base64 - Base64 encoded string
 * @returns Uint8Array ready for file writing
 * @throws Error if base64 is invalid or empty
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('Invalid base64 input: must be a non-empty string');
  }

  if (base64.trim().length === 0) {
    throw new Error('Base64 string cannot be empty or whitespace');
  }

  try {
    const binaryString = atob(base64);

    if (binaryString.length === 0) {
      throw new Error('Base64 decoded to empty data');
    }

    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to decode base64: ${error.message}`);
    }
    throw new Error('Failed to decode base64: Unknown error');
  }
}

/**
 * Safely delete a file if it exists
 * Handles errors gracefully and logs warnings
 *
 * @param uri - File URI to delete
 * @returns true if deleted, false if didn't exist
 */
export async function safeDeleteFile(uri: string): Promise<boolean> {
  try {
    const file = new File(uri);
    if (file.exists) {
      await file.delete();
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[FileSystem] Failed to delete file ${uri}:`, error);
    return false;
  }
}

/**
 * Create a directory if it doesn't exist
 * Thread-safe with error handling
 *
 * @param directory - Directory object to create
 */
export function ensureDirectoryExists(directory: Directory): void {
  try {
    if (!directory.exists) {
      directory.create();
    }
  } catch (error) {
    // If error is "already exists", it's safe to ignore
    if (error instanceof Error && !error.message.includes('already exists')) {
      throw error;
    }
  }
}
