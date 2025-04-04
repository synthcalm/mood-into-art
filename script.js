
let audioContext, processor, input, globalStream;
let socket;
let isRecording = false;
let countdownInterval;
const MAX_RECORD_TIME = 60;

const startButton = document.getElementById('startVoice');
const activityInput = document.getElementById('activityInput');
const countdownDisplay = document.getElementById('countdownDisplay');
const waveform = document.getElementById('waveform');
const waveformCtx = waveform.getContext('2d');

startButton.addEventListener('click', async () => {
  if (!isRecording) {
    const tokenRes = await fetch('https://mood-into-art-backend.onrender.com/assemblyai-token');
    const { token } = await tokenRes.json();

    socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`, []);
    socket.onopen = () => console.log('WebSocket connected');
    socket.onmessage = (message) => {
      const res = JSON.parse(message.data);
      if (res.text && res.message_type === "FinalTranscript") {
        activityInput.value = res.text;
      }
    };

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    globalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    input = audioContext.createMediaStreamSource(globalStream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    const sampleRate = 16000;
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const downsampledBuffer = downsampleBuffer(inputData, audioContext.sampleRate, sampleRate);
      const int16Array = convertFloat32ToInt16(downsampledBuffer);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(int16Array);
      }
    };

    input.connect(processor);
    processor.connect(audioContext.destination);

    isRecording = true;
    startButton.textContent = "Stop Voice";
    startCountdown();
  } else {
    socket?.close();
    processor?.disconnect();
    input?.disconnect();
    globalStream?.getTracks().forEach(track => track.stop());
    audioContext?.close();

    isRecording = false;
    startButton.textContent = "Start Voice";
    clearInterval(countdownInterval);
  }
});

function downsampleBuffer(buffer, sampleRate, outSampleRate) {
  const ratio = sampleRate / outSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    result[i] = buffer[Math.round(i * ratio)];
  }
  return result;
}

function convertFloat32ToInt16(buffer) {
  let l = buffer.length;
  const result = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    result[i] = Math.min(1, buffer[i]) * 0x7FFF;
  }
  return result;
}

function startCountdown() {
  let seconds = MAX_RECORD_TIME;
  countdownInterval = setInterval(() => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    countdownDisplay.textContent = \`\${String(mins).padStart(2, '0')}:\${String(secs).padStart(2, '0')}\`;
    if (--seconds < 0) clearInterval(countdownInterval);
  }, 1000);
}
