class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      const int16 = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        int16[i] = Math.max(-1, Math.min(1, channelData[i])) * 32767;
      }
      this.port.postMessage(int16.buffer);
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
