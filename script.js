// === Setup Speech Recognition ===
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;
let socket = null;
let countdown = 60;
let countdownInterval = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');
    document.getElementById('activityInput').value = transcript;
  };

  recognition.onerror = (event) => {
    console.error('🎤 Speech recognition error:', event.error);
    alert(`Speech recognition error: ${event.error}`);
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording) {
      recognition.start(); // Restart if still recording
    }
  };

  recognition.onstart = () => console.log("✅ Speech recognition started");
  recognition.onnomatch = () => console.warn("🤷 No match");
  recognition.onaudioend = () => console.log("🔇 Audio ended");
} else {
  console.warn('⚠️ SpeechRecognition not supported. Will use AssemblyAI fallback.');
}

// === Setup Canvas Waveform ===
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
      console.error('🎤 Microphone access error:', err);
      alert('Microphone access error. Please check permissions.');
      stopRecording();
    });
}

function drawWaveform() {
  if (!isRecording) return;
  console.log("📈 Drawing waveform...");
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

// === AssemblyAI fallback ===
async function setupAssemblyAI() {
  try {
    const res = await fetch('https://mood-into-art-backend.onrender.com/assemblyai-token');
    if (!res.ok) throw new Error('Failed to get AssemblyAI token');
    const { token } = await res.json();

    socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?token=${token}`);
    socket.onopen = () => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.ondataavailable = (event) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(event.data);
            }
          };
          mediaRecorder.start(250);
        })
        .catch(err => {
          console.error('🎤 AssemblyAI mic error:', err);
          alert('Mic access for AssemblyAI failed.');
          stopRecording();
        });
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.text) {
        document.getElementById('activityInput').value = data.text;
      }
    };

    socket.onerror = (err) => {
      console.error('🧨 AssemblyAI WebSocket error:', err);
      alert('AssemblyAI connection error.');
      stopRecording();
    };

    socket.onclose = () => {
      socket = null;
    };
  } catch (err) {
    console.error('❌ Error setting up AssemblyAI:', err);
    alert('AssemblyAI setup failed.');
    stopRecording();
  }
}

// === Voice Controls ===
function startRecording() {
  console.log("🎙️ startRecording() triggered");
  navigator.permissions.query({ name: 'microphone' }).then(permission => {
    console.log("📟 Mic permission:", permission.state);
    if (permission.state === 'granted') {
      beginVoiceCapture();
    } else if (permission.state === 'prompt') {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
        console.log("🔓 Mic allowed after prompt");
        beginVoiceCapture();
      }).catch(err => {
        console.error('❌ Mic denied:', err);
        alert('Mic permission denied.');
      });
    } else {
      alert('Mic permission denied. Enable it in your browser settings.');
    }
  });
}

function beginVoiceCapture() {
  isRecording = true;
  document.getElementById('startVoice').textContent = 'Stop Voice';
  countdown = 60;
  document.getElementById('countdownDisplay').textContent = `00:${countdown.toString().padStart(2, '0')}`;
  countdownInterval = setInterval(updateCountdown, 1000);

  if (recognition) {
    console.log("🔊 Starting browser recognition...");
    recognition.start();
  } else {
    console.log("🛰️ Using AssemblyAI...");
    setupAssemblyAI();
  }

  setupWaveform();
}

function stopRecording() {
  isRecording = false;
  document.getElementById('startVoice').textContent = 'Start Voice';
  if (recognition) recognition.stop();
  if (socket) socket.close();
  if (audioContext) audioContext.close();
  if (countdownInterval) clearInterval(countdownInterval);
  countdown = 60;
  document.getElementById('countdownDisplay').textContent = `00:${countdown.toString().padStart(2, '0')}`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateCountdown() {
  countdown--;
  document.getElementById('countdownDisplay').textContent = `00:${countdown.toString().padStart(2, '0')}`;
  if (countdown <= 0) stopRecording();
}

// === UI Events ===
document.getElementById('startVoice').addEventListener('click', () => {
  isRecording ? stopRecording() : startRecording();
});

document.getElementById('redo').addEventListener('click', () => {
  stopRecording();
  document.getElementById('activityInput').value = '';
  document.getElementById('styleSelect').value = 'none';
  document.getElementById('generatedImage').style.display = 'none';
});

// === Generate Image ===
document.getElementById('generate').addEventListener('click', async () => {
  const mood = document.getElementById('activityInput').value;
  const style = document.getElementById('styleSelect').value;
  console.log(`🟡 Generate clicked — Mood: "${mood}", Style: "${style}"`);

  if (mood && style !== 'none') {
    try {
      const res = await fetch('https://mood-into-art-backend.onrender.com/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${mood} in ${style} style` }),
      });

      if (!res.ok) throw new Error('Failed to generate image');
      const data = await res.json();

      if (data.image) {
        console.log("✅ Image received");
        document.getElementById('generatedImage').src = `data:image/png;base64,${data.image}`;
        document.getElementById('generatedImage').style.display = 'block';

        const history = document.getElementById('moodHistory');
        const entry = document.createElement('div');
        entry.style.display = 'flex';
        entry.style.justifyContent = 'space-between';
        entry.style.marginBottom = '5px';

        const text = document.createElement('span');
        text.textContent = `${new Date().toLocaleString()} — ${mood} [${style}]`;
        entry.appendChild(text);

        const del = document.createElement('button');
        del.textContent = 'Delete';
        del.style.background = '#000';
        del.style.color = '#0ff';
        del.style.border = '1px solid #0ff';
        del.style.padding = '2px 5px';
        del.addEventListener('click', () => history.removeChild(entry));
        entry.appendChild(del);

        history.prepend(entry);
      } else {
        alert('No image returned from backend.');
      }
    } catch (err) {
      console.error('❌ Generate error:', err);
      alert('Something went wrong. Try again.');
    }
  } else {
    alert('Please enter a mood and select a style.');
  }
});

// === Save Image ===
document.getElementById('saveImage').addEventListener('click', () => {
  const image = document.getElementById('generatedImage');
  if (image.src) {
    const a = document.createElement('a');
    a.href = image.src;
    a.download = 'mood-art.png';
    a.click();
  } else {
    alert('Please generate an image first.');
  }
});

// === Update Date & Time ===
setInterval(() => {
  const now = new Date();
  document.getElementById('dateTimeDisplay').textContent =
    now.toLocaleDateString('en-US') + '\n' + now.toLocaleTimeString('en-US');
}, 1000);
