export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Codigo del AudioWorklet que convierte Float32 -> PCM16, como blob URL
export function createPcmWorkletUrl() {
  const workletCode = `
    class PCMEncoder extends AudioWorkletProcessor {
        process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input.length > 0) {
                const channelData = input[0];
                const int16Data = new Int16Array(channelData.length);
                for (let i = 0; i < channelData.length; i++) {
                    int16Data[i] = Math.max(-1, Math.min(1, channelData[i])) * 0x7FFF;
                }
                this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
            }
            return true;
        }
    }
    registerProcessor('pcm-encoder', PCMEncoder);
  `;
  const blob = new Blob([workletCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

export function float32ToPcm16(float32) {
  const pcmData = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    pcmData[i] = Math.max(-1, Math.min(1, float32[i])) * 0x7fff;
  }
  return pcmData;
}