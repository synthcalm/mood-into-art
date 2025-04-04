// === iOS-Ready Version: Mood Into Art with Deepgram + AssemblyAI ===
// ✅ Deepgram on iOS (Safari)
// ✅ AssemblyAI on other platforms
// ✅ Displays waveform, countdown, transcription, and animated thinking dots
// ✅ Auto-generates image when recording stops

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
if (isIOS && window.top !== window.self) {
  alert("🔓 To use the microphone, please open this page in full Safari tab (not embedded in another app or iframe).\n");
}

let isRecording = false;
let socket = null;
let countdown = 60;
let countdownInterval = null;
let thinkingInterval = null;
let recorder = null;

const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');
let audioContext, analyser, dataArray, source;

function setupWaveform() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      drawWaveform();
    })
    .catch(err => {
      console.error('🎤 Mic error:', err);
      alert('Microphone access failed.');
      stopRecording();
    });
}

function drawWaveform() {
  if (!isRecording) return;
  requestAnimationFrame(drawWaveform);
  analyser.getByteTimeDomainData(dataArray);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ff0';
  ctx.beginPath();

  const sliceWidth = canvas.width / dataArray.length;
  let x = 0;

  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * canvas.height) / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }

  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
}

function startThinkingAnimation() {
  const thinking = document.getElementById('thinking');
  if (!thinking) return;
  let dotCount = 0;
  thinking.style.display = 'block';
  thinking.textContent = 'Listening';

  thinkingInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 5;
    thinking.textContent = 'Listening' + '.'.repeat(dotCount);
  }, 500);
}

function stopThinkingAnimation() {
  const thinking = document.getElementById('thinking');
  if (!thinking) return;
  clearInterval(thinkingInterval);
  thinking.textContent = '';
  thinking.style.display = 'none';
}

async function setupTranscription() {
  const endpoint = isIOS 
    ? 'https://mood-into-art-backend.onrender.com/deepgram-token' 
    : 'https://mood-into-art-backend.onrender.com/assemblyai-token';

  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Token request failed');
    const { token } = await res.json();

    socket = new WebSocket(
      isIOS
        ? `wss://api.deepgram.com/v1/listen?access_token=${token}`
        : `wss://api.assemblyai.com/v2/realtime/ws?token=${token}`
    );

    socket.onopen = () => {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = e => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(e.data);
          }
        };
        recorder.start(250);
      });
    };

    socket.onmessage = e => {
      const data = JSON.parse(e.data);
      const text = isIOS
        ? data.channel?.alternatives?.[0]?.transcript
        : data.text;
      if (text) document.getElementById('activityInput').value = text;
    };

    socket.onerror = err => {
      console.error('WebSocket error:', err);
      stopRecording();
    };
    socket.onclose = () => socket = null;

  } catch (err) {
    console.error('Transcription setup error:', err);
    alert('Failed to setup transcription');
    stopRecording();
  }
}

function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => {
      isRecording = true;
      document.getElementById('startVoice').textContent = 'Stop Voice';
      countdown = 60;
      document.getElementById('countdownDisplay').textContent = `00:${countdown}`;
      countdownInterval = setInterval(updateCountdown, 1000);
      startThinkingAnimation();
      setupTranscription();
      setupWaveform();
    })
    .catch(() => alert('Microphone access denied.'));
}

function stopRecording() {
  isRecording = false;
  document.getElementById('startVoice').textContent = 'Start Voice';
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  if (socket) socket.close();
  if (audioContext) audioContext.close();
  clearInterval(countdownInterval);
  countdown = 60;
  document.getElementById('countdownDisplay').textContent = `00:${countdown}`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  stopThinkingAnimation();
  triggerImageGeneration();
}

function updateCountdown() {
  countdown--;
  document.getElementById('countdownDisplay').textContent = `00:${countdown.toString().padStart(2, '0')}`;
  if (countdown <= 0) stopRecording();
}

function triggerImageGeneration() {
  const mood = document.getElementById('activityInput').value;
  const style = document.getElementById('styleSelect').value;
  if (!mood || style === 'none') return;
  document.getElementById('generate').click();
}

document.getElementById('startVoice').addEventListener('click', () => {
  isRecording ? stopRecording() : startRecording();
});
