// === Mood Into Art with Dual Transcription: Deepgram (iOS) + Web Speech API (desktop) + UX Enhancements ===

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
if (isIOS && window.top !== window.self) {
  alert("🔓 To use the microphone, please open this page in full Safari tab (not embedded in another app or iframe).\n");
}

let isRecording = false;
let countdown = 60;
let countdownInterval = null;
let thinkingInterval = null;
let recognition = null;
let transcriptBuffer = "";
let recorder = null;
let socket = null;

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

function showListeningText() {
  const thinking = document.getElementById('thinking');
  if (thinking) {
    thinking.textContent = 'Listening';
    thinking.style.display = 'block';
  }
}

function startGeneratingDots() {
  const thinking = document.getElementById('thinking');
  if (!thinking) return;
  let dotCount = 0;
  thinkingInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 5;
    thinking.textContent = 'Generating' + '.'.repeat(dotCount);
  }, 500);
}

function stopThinkingText() {
  const thinking = document.getElementById('thinking');
  if (!thinking) return;
  clearInterval(thinkingInterval);
  thinking.textContent = '';
  thinking.style.display = 'none';
}

function setupWebSpeechAPI() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Web Speech API not supported in this browser");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = event => {
    const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
    document.getElementById('activityInput').value = transcript;
    transcriptBuffer = transcript;
  };

  recognition.onerror = err => {
    console.error('🎤 Web Speech API error:', err);
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording) recognition.start();
  };

  recognition.start();
}

function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => {
      isRecording = true;
      transcriptBuffer = "";
      document.getElementById('activityInput').value = "";
      document.getElementById('startVoice').textContent = 'Stop Voice';
      countdown = 60;
      document.getElementById('countdownDisplay').textContent = `00:${countdown}`;
      countdownInterval = setInterval(updateCountdown, 1000);
      showListeningText();
      setupWaveform();

      if (isIOS) {
        setupDeepgram();
      } else {
        setupWebSpeechAPI();
      }
    })
    .catch(err => {
      console.error("❌ Mic access denied:", err);
      alert('Microphone access denied. Please check browser and OS settings.');
    });
}

function setupDeepgram() {
  fetch('https://mood-into-art-backend.onrender.com/deepgram-token')
    .then(res => res.json())
    .then(({ token }) => {
      socket = new WebSocket(`wss://api.deepgram.com/v1/listen?access_token=${token}`);

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
        const text = data.channel?.alternatives?.[0]?.transcript;
        if (text && text.length > 0) {
          transcriptBuffer += (transcriptBuffer && !transcriptBuffer.endsWith(" ") ? " " : "") + text;
          document.getElementById('activityInput').value = transcriptBuffer;
        }
      };

      socket.onerror = err => {
        console.error('Deepgram error:', err);
        stopRecording();
      };

      socket.onclose = () => {
        console.log("🔌 Deepgram WebSocket closed");
        socket = null;
      };
    })
    .catch(err => {
      console.error("Deepgram token error:", err);
      alert("Could not connect to Deepgram");
      stopRecording();
    });
}

function stopRecording() {
  isRecording = false;
  document.getElementById('startVoice').textContent = 'Start Voice';
  if (recognition) recognition.stop();
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  if (audioContext && audioContext.state !== 'closed') audioContext.close();
  clearInterval(countdownInterval);
  countdown = 60;
  document.getElementById('countdownDisplay').textContent = `00:${countdown}`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  stopThinkingText();
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

// === Button bindings ===
document.getElementById('startVoice').addEventListener('click', () => {
  isRecording ? stopRecording() : startRecording();
});

document.getElementById('redo').addEventListener('click', () => {
  stopRecording();
  document.getElementById('activityInput').value = '';
  document.getElementById('styleSelect').value = 'none';
  const image = document.getElementById('generatedImage');
  image.src = '';
  image.style.display = 'none';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

document.getElementById('generate').addEventListener('click', async () => {
  const mood = document.getElementById('activityInput').value;
  const style = document.getElementById('styleSelect').value;
  const image = document.getElementById('generatedImage');
  const thinking = document.getElementById('thinking');
  if (!mood || style === 'none') return;

  startGeneratingDots();
  thinking.style.display = 'block';

  try {
    const res = await fetch('https://mood-into-art-backend.onrender.com/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: `${mood} in ${style} style` })
    });

    const data = await res.json();
    if (data.image) {
      image.src = `data:image/png;base64,${data.image}`;
      image.style.display = 'block';

      const history = document.getElementById('moodHistory');
      const entry = document.createElement('div');
      entry.className = 'history-entry';

      const text = document.createElement('span');
      text.textContent = `${new Date().toLocaleString()} — ${mood} [${style}]`;
      entry.appendChild(text);

      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.addEventListener('click', () => history.removeChild(entry));
      entry.appendChild(del);

      history.prepend(entry);
    } else {
      alert("No image received");
    }
  } catch (err) {
    console.error('Error generating image:', err);
    alert("Failed to generate image.");
  } finally {
    stopThinkingText();
  }
});
