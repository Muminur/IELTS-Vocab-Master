// Utility to handle Gemini raw PCM audio data

export const decodeAudioData = async (
  base64String: string,
  audioContext: AudioContext,
  sampleRate: number = 24000 // Default for Gemini TTS
): Promise<AudioBuffer> => {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Convert Uint8Array (raw bytes) to Int16Array (PCM)
  // Note: Gemini returns 16-bit PCM.
  const dataInt16 = new Int16Array(bytes.buffer);
  
  const numChannels = 1;
  const frameCount = dataInt16.length;
  
  const buffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0); // Mono channel

  // Normalize Int16 to Float32 (-1.0 to 1.0)
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }

  return buffer;
};

export const playAudioBuffer = (
  buffer: AudioBuffer,
  audioContext: AudioContext
): AudioBufferSourceNode => {
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start(0);
  return source;
};
