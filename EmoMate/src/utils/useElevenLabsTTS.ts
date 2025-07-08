import { useState, useCallback, useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { ELEVENLABS_CONFIG, getElevenLabsApiKey } from '../constants/ai';

export interface UseElevenLabsTTSReturn {
  isSpeaking: boolean;
  isGenerating: boolean; // 新增：是否正在生成语音
  error: string | null;
  speak: (text: string, voiceId?: string) => Promise<void>;
  stop: () => Promise<void>;
}

export const useElevenLabsTTS = (): UseElevenLabsTTSReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false); // 新增：语音生成状态
  const [playbackTimer, setPlaybackTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Initialize audio player with null to avoid native module errors
  const audioPlayer = useAudioPlayer(null);

  const generateSpeechFile = async (text: string, voiceId?: string): Promise<string> => {
    const apiKey = getElevenLabsApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API密钥未配置。请在环境变量中设置ELEVENLABS_API_KEY。');
    }

    const voice = voiceId || ELEVENLABS_CONFIG.voices[ELEVENLABS_CONFIG.defaultVoice];
    const url = `${ELEVENLABS_CONFIG.baseURL}/text-to-speech/${voice}`;
    
    // 创建临时文件路径
    const fileName = `elevenlabs_${Date.now()}.mp3`;
    const fileUri = FileSystem.documentDirectory + fileName;

    // 使用 XMLHttpRequest 来正确处理二进制数据
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.responseType = 'blob';
      
      // 设置请求头
      xhr.setRequestHeader('Accept', 'audio/mpeg');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('xi-api-key', apiKey);
      
      xhr.onload = async () => {
        if (xhr.status === 200) {
          try {
            // 将 blob 转换为 base64 并保存到文件
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64data = reader.result as string;
              const base64Audio = base64data.split(',')[1]; // 移除 data:audio/mpeg;base64, 前缀
              
              await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
                encoding: FileSystem.EncodingType.Base64,
              });
              
              resolve(fileUri);
            };
            reader.readAsDataURL(xhr.response);
          } catch (error) {
            reject(new Error(`保存音频文件失败: ${error}`));
          }
        } else {
          reject(new Error(`ElevenLabs API调用失败: ${xhr.status}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error('网络请求失败'));
      };
      
      // 发送请求
      const postData = JSON.stringify({
        text: text,
        model_id: ELEVENLABS_CONFIG.defaultModel,
        voice_settings: ELEVENLABS_CONFIG.settings,
      });
      
      xhr.send(postData);
    });
  };

  // Monitor audio player state changes
  useEffect(() => {
    // isSpeaking 只在实际播放音频时为 true
    setIsSpeaking(audioPlayer.playing);
    
    // 检查音频是否播放完成（currentTime >= duration）
    if (!audioPlayer.playing && audioPlayer.duration > 0 && audioPlayer.currentTime >= audioPlayer.duration - 0.1) {
      setIsSpeaking(false);
      // 清理备用定时器
      if (playbackTimer) {
        clearTimeout(playbackTimer);
        setPlaybackTimer(null);
      }
    }
    
    // 当音频播放完成时清理临时文件
    if (!audioPlayer.playing && !isGenerating && audioUri && audioPlayer.currentTime > 0) {
      // 延迟清理，确保音频已完全停止
      setTimeout(() => {
        FileSystem.deleteAsync(audioUri, { idempotent: true });
        setAudioUri(null);
      }, 500);
    }
  }, [audioPlayer.playing, audioUri, audioPlayer.currentTime, audioPlayer.duration, isGenerating]);

  const speak = useCallback(async (text: string, voiceId?: string) => {
    if (!text.trim()) return;

    try {
      setError(null);
      setIsGenerating(true); // 开始生成语音
      
      // 停止当前播放
      if (audioPlayer.playing) {
        audioPlayer.pause();
        audioPlayer.seekTo(0);
      }

      // 清理之前的音频文件
      if (audioUri) {
        FileSystem.deleteAsync(audioUri, { idempotent: true });
      }

      // 生成语音文件
      const newAudioUri = await generateSpeechFile(text, voiceId);
      
      // 使用 replace 方法设置新的音频源
      audioPlayer.replace(newAudioUri);
      setAudioUri(newAudioUri);
      
      // 等待音频加载完成后播放
      setTimeout(() => {
        audioPlayer.play();
        // 强制在播放后短暂延迟重置生成状态，确保状态转换
        setTimeout(() => {
          setIsGenerating(false);
          
          // 设置备用定时器，基于估算的播放时长来停止播放状态
          // 估算：每个字符约0.2秒，加上1秒缓冲时间
          const estimatedDuration = (text.length * 0.2 + 1) * 1000;
          const timer = setTimeout(() => {
            setIsSpeaking(false);
          }, estimatedDuration);
          setPlaybackTimer(timer);
        }, 50);
      }, 100);

    } catch (err) {
      setError(err instanceof Error ? err.message : '语音合成失败');
      setIsGenerating(false);
      setIsSpeaking(false);
      console.error('ElevenLabs TTS Error:', err);
    }
  }, [audioPlayer, audioUri]);

  const stop = useCallback(async () => {
    try {
      if (audioPlayer.playing) {
        audioPlayer.pause();
        audioPlayer.seekTo(0);
      }
      
      // 停止所有状态
      setIsGenerating(false);
      setIsSpeaking(false);
      
      // 清理备用定时器
      if (playbackTimer) {
        clearTimeout(playbackTimer);
        setPlaybackTimer(null);
      }
      
      // 清理临时音频文件
      if (audioUri) {
        FileSystem.deleteAsync(audioUri, { idempotent: true });
        setAudioUri(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '停止播放失败');
      setIsGenerating(false);
      setIsSpeaking(false); // 确保即使出错也重置状态
      // 清理备用定时器
      if (playbackTimer) {
        clearTimeout(playbackTimer);
        setPlaybackTimer(null);
      }
    }
  }, [audioPlayer, audioUri, playbackTimer]);

  return {
    isSpeaking,
    isGenerating,
    error,
    speak,
    stop,
  };
};