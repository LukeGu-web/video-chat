/**
 * Audio Mode Manager
 * Centralized management of expo-audio mode to prevent conflicts between playback and recording
 *
 * Problem Solved:
 * - When user starts speaking while AI is playing audio, allowsRecording is set to true,
 *   causing volume to drop suddenly
 * - This manager ensures only one audio mode is active at a time
 */

import { setAudioModeAsync } from 'expo-audio';

type AudioMode = 'playback' | 'recording' | 'idle';

class AudioModeManager {
  private currentMode: AudioMode = 'idle';
  private isTransitioning: boolean = false;

  /**
   * Get current audio mode
   */
  getCurrentMode(): AudioMode {
    return this.currentMode;
  }

  /**
   * Check if currently in playback mode
   */
  isPlaybackMode(): boolean {
    return this.currentMode === 'playback';
  }

  /**
   * Check if currently in recording mode
   */
  isRecordingMode(): boolean {
    return this.currentMode === 'recording';
  }

  /**
   * Set audio mode to playback (allowsRecording: false)
   * This increases audio output volume
   */
  async setPlaybackMode(): Promise<void> {
    if (this.currentMode === 'playback' && !this.isTransitioning) {
      return; // Already in playback mode
    }

    this.isTransitioning = true;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false, // Disable recording for louder playback
        shouldPlayInBackground: true,
        interruptionMode: 'duckOthers',
        interruptionModeAndroid: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });
      this.currentMode = 'playback';
      console.log('[AudioModeManager] ✅ Switched to PLAYBACK mode (allowsRecording: false)');
    } catch (error) {
      console.error('[AudioModeManager] ❌ Failed to set playback mode:', error);
      throw error;
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Set audio mode to recording (allowsRecording: true)
   * This enables microphone input
   */
  async setRecordingMode(): Promise<void> {
    if (this.currentMode === 'recording' && !this.isTransitioning) {
      return; // Already in recording mode
    }

    this.isTransitioning = true;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true, // Enable recording
        shouldPlayInBackground: true,
        interruptionMode: 'duckOthers',
        interruptionModeAndroid: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });
      this.currentMode = 'recording';
      console.log('[AudioModeManager] ✅ Switched to RECORDING mode (allowsRecording: true)');
    } catch (error) {
      console.error('[AudioModeManager] ❌ Failed to set recording mode:', error);
      throw error;
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Set audio mode to idle (allowsRecording: true by default)
   * This is the neutral state
   */
  async setIdleMode(): Promise<void> {
    if (this.currentMode === 'idle' && !this.isTransitioning) {
      return; // Already in idle mode
    }

    this.isTransitioning = true;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true, // Enable recording for idle state
        shouldPlayInBackground: true,
        interruptionMode: 'duckOthers',
        interruptionModeAndroid: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });
      this.currentMode = 'idle';
      console.log('[AudioModeManager] ✅ Switched to IDLE mode (allowsRecording: true)');
    } catch (error) {
      console.error('[AudioModeManager] ❌ Failed to set idle mode:', error);
      throw error;
    } finally {
      this.isTransitioning = false;
    }
  }
}

// Export singleton instance
export const audioModeManager = new AudioModeManager();
