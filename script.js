// === iOS-Ready Version: Mood Into Art ===
// ✅ Uses AssemblyAI only (no SpeechRecognition)
// ✅ Works on desktop and iOS Safari
// ✅ Displays waveform + countdown + transcription

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
if (isIOS && window.top !== window.self) {
  alert("🔓 To use the microphone, please open this page in full Safari tab (not embedded in another app or iframe).\n");
}

let isRecording = false;
let socket = null;
let countdown = 60;
let countdownInterval = null;

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

function setupAssemblyAI() {
  fetch('https://mood-into-art-backend.onrender.com/assemblyai-token')
    .then(res => res.json())
    .then(({ token }) => {
      socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?token=${token}`);

      socket.onopen = () => {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = e => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(e.data);
            }
          };
          recorder.start(250);
        });
      };

      socket.onmessage = msg => {
        const data = JSON.parse(msg.data);
        if (data.text) {
          document.getElementById('activityInput').value = data.text;
        }
      };

      socket.onerror = err => {
        console.error('AssemblyAI error:', err);
        stopRecording();
      };

      socket.onclose = () => socket = null;
    })
    .catch(err => {
      console.error('Token fetch failed:', err);
      alert('AssemblyAI setup failed.');
      stopRecording();
    });
}

function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => {
      isRecording = true;
      document.getElementById('startVoice').textContent = 'Stop Voice';
      countdown = 60;
      document.getElementById('countdownDisplay').textContent = `00:${countdown}`;
      countdownInterval = setInterval(updateCountdown, 1000);
      setupAssemblyAI();
      setupWaveform();
    })
    .catch(err => {
      alert('Microphone access denied.');
    });
}

function stopRecording() {
  isRecording = false;
  document.getElementById('startVoice').textContent = 'Start Voice';
  if (socket) socket.close();
  if (audioContext) audioContext.close();
  clearInterval(countdownInterval);
  countdown = 60;
  document.getElementById('countdownDisplay').textContent = `00:${countdown}`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateCountdown() {
  countdown--;
  document.getElementById('countdownDisplay').textContent = `00:${countdown.toString().padStart(2, '0')}`;
  if (countdown <= 0) stopRecording();
}

document.getElementById('startVoice').addEventListener('click', () => {
  isRecording ? stopRecording() : startRecording();
});
