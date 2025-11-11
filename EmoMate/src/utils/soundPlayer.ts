/**
 * Sound Player using react-native-sound
 * This player is used for TTS audio playback to avoid expo-audio AudioMode conflicts
 *
 * Key Benefits:
 * - No AudioMode management needed (react-native-sound handles speaker output directly)
 * - Better volume control (no conflict with recording AudioMode)
 * - Simpler audio session management
 */

import Sound from 'react-native-sound';

export interface SoundPlayerCallbacks {
  onPlaybackStatusUpdate?: (status: {
    playing: boolean;
    currentTime: number;
    duration: number;
  }) => void;
  onPlaybackFinished?: () => void;
  onError?: (error: Error) => void;
}

export class SoundPlayer {
  private sound: Sound | null = null;
  private isPlaying: boolean = false;
  private currentPosition: number = 0;
  private totalDuration: number = 0;
  private callbacks: SoundPlayerCallbacks = {};
  private updateTimer: NodeJS.Timeout | null = null;

  constructor() {
    // CRITICAL: Set audio category to Playback with speaker output
    // This ensures audio routes through the speaker instead of the earpiece
    Sound.setCategory('Playback', true);
    console.log('[SoundPlayer] ✅ Audio category set to Playback (speaker output)');
  }

  /**
   * Load and play audio file
   */
  async play(uri: string, callbacks?: SoundPlayerCallbacks): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean up previous sound
      this.release();

      // CRITICAL: Force set audio category before EVERY playback
      // This ensures expo-audio's setAudioModeAsync doesn't override our settings
      Sound.setCategory('Playback', true);
      console.log('[SoundPlayer] 🔊 Force setting Playback category (speaker output)');

      // Store callbacks
      if (callbacks) {
        this.callbacks = callbacks;
      }

      // Remove file:// prefix if present (react-native-sound doesn't need it)
      const cleanUri = uri.replace('file://', '');

      // Create new sound instance
      this.sound = new Sound(cleanUri, '', (error) => {
        if (error) {
          console.error('[SoundPlayer] Failed to load sound:', error);
          this.callbacks.onError?.(error);
          reject(error);
          return;
        }

        if (!this.sound) {
          const loadError = new Error('Sound instance is null after loading');
          this.callbacks.onError?.(loadError);
          reject(loadError);
          return;
        }

        // Get duration
        this.totalDuration = this.sound.getDuration();
        console.log('[SoundPlayer] ✅ Sound loaded, duration:', this.totalDuration);

        // Set volume to maximum
        this.sound.setVolume(1.0);

        // Start playback
        this.sound.play((success) => {
          if (success) {
            console.log('[SoundPlayer] ✅ Playback finished successfully');
            this.isPlaying = false;
            this.currentPosition = 0;
            this.stopUpdateTimer();
            this.callbacks.onPlaybackFinished?.();
          } else {
            console.error('[SoundPlayer] ❌ Playback failed');
            this.isPlaying = false;
            this.stopUpdateTimer();
            const playbackError = new Error('Playback failed');
            this.callbacks.onError?.(playbackError);
          }
        });

        this.isPlaying = true;
        this.startUpdateTimer();

        resolve();
      });
    });
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.sound && this.isPlaying) {
      this.sound.pause();
      this.isPlaying = false;
      this.stopUpdateTimer();
      console.log('[SoundPlayer] ⏸️ Paused');
    }
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.sound && !this.isPlaying) {
      this.sound.play((success) => {
        if (success) {
          console.log('[SoundPlayer] ✅ Playback finished after resume');
          this.isPlaying = false;
          this.currentPosition = 0;
          this.stopUpdateTimer();
          this.callbacks.onPlaybackFinished?.();
        } else {
          console.error('[SoundPlayer] ❌ Playback failed after resume');
          this.isPlaying = false;
          this.stopUpdateTimer();
          this.callbacks.onError?.(new Error('Playback failed after resume'));
        }
      });
      this.isPlaying = true;
      this.startUpdateTimer();
      console.log('[SoundPlayer] ▶️ Resumed');
    }
  }

  /**
   * Stop playback and reset position
   */
  stop(): void {
    if (this.sound) {
      this.sound.stop(() => {
        console.log('[SoundPlayer] ⏹️ Stopped');
      });
      this.isPlaying = false;
      this.currentPosition = 0;
      this.stopUpdateTimer();
    }
  }

  /**
   * Seek to specific position (in seconds)
   */
  seekTo(seconds: number): void {
    if (this.sound) {
      this.sound.setCurrentTime(seconds);
      this.currentPosition = seconds;
      console.log('[SoundPlayer] ⏩ Seeked to:', seconds);
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    if (this.sound) {
      this.sound.setVolume(Math.max(0, Math.min(1, volume)));
      console.log('[SoundPlayer] 🔊 Volume set to:', volume);
    }
  }

  /**
   * Release sound resources
   */
  release(): void {
    this.stopUpdateTimer();
    if (this.sound) {
      this.sound.release();
      this.sound = null;
      this.isPlaying = false;
      this.currentPosition = 0;
      this.totalDuration = 0;
      console.log('[SoundPlayer] 🧹 Released');
    }
  }

  /**
   * Get current playback status
   */
  getStatus() {
    return {
      playing: this.isPlaying,
      currentTime: this.currentPosition,
      duration: this.totalDuration,
    };
  }

  /**
   * Start timer to update current position
   */
  private startUpdateTimer(): void {
    this.stopUpdateTimer();
    this.updateTimer = setInterval(() => {
      if (this.sound && this.isPlaying) {
        this.sound.getCurrentTime((seconds) => {
          this.currentPosition = seconds;
          this.callbacks.onPlaybackStatusUpdate?.({
            playing: this.isPlaying,
            currentTime: seconds,
            duration: this.totalDuration,
          });
        });
      }
    }, 50); // Update every 50ms for smooth UI updates
  }

  /**
   * Stop update timer
   */
  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Check if currently playing
   */
  get playing(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current time in seconds
   */
  get currentTime(): number {
    return this.currentPosition;
  }

  /**
   * Get total duration in seconds
   */
  get duration(): number {
    return this.totalDuration;
  }
}
