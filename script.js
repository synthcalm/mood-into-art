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
let hasGenerated = false;

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

  ctx.fillStyle = '#00CED1';
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
  console.log("Device type:", isIOS ? "iOS" : "Desktop");
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => {
      isRecording = true;
      transcriptBuffer = "";
      document.getElementById('activityInput').value = "";
      const startVoiceButton = document.getElementById('startVoice');
      startVoiceButton.textContent = 'Stop Voice';
      startVoiceButton.style.backgroundColor = 'red !important';
      startVoiceButton.style.color = 'white !important';
      startVoiceButton.style.borderColor = 'red !important';
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
    .then(res => {
      if (!res.ok) {
        throw new Error(`Failed to fetch Deepgram token: ${res.statusText}`);
      }
      return res.json();
    })
    .then(({ token }) => {
      socket = new WebSocket(`wss://api.deepgram.com/v1/listen?access_token=${token}`);

      socket.onopen = () => {
        console.log("Deepgram WebSocket opened successfully");
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          recorder = new MediaRecorder(stream);
          recorder.ondataavailable = e => {
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(e.data);
            }
          };
          recorder.start(250);
        }).catch(err => {
          console.error("Deepgram mic access error:", err);
          alert("Deepgram failed to access microphone. Falling back to Web Speech API.");
          setupWebSpeechAPI();
        });
      };

      socket.onmessage = e => {
        const data = JSON.parse(e.data);
        const text = data.channel?.alternatives?.[0]?.transcript;
        if (text && text.length > 0) {
          transcriptBuffer += (transcriptBuffer && !transcriptBuffer.endsWith(" ") ? " " : "") + text;
          document.getElementById('activityInput').value = transcriptBuffer;
        } else {
          console.log("Deepgram received message, but no transcript:", data);
        }
      };

      socket.onerror = err => {
        console.error('Deepgram WebSocket error:', err);
        stopRecording();
        alert("Deepgram WebSocket error. Falling back to Web Speech API.");
        setupWebSpeechAPI();
      };

      socket.onclose = () => {
        console.log("🔌 Deepgram WebSocket closed");
        socket = null;
      };
    })
    .catch(err => {
      console.error("Deepgram token fetch error:", err);
      alert("Could not connect to Deepgram. Falling back to Web Speech API.");
      stopRecording();
      setupWebSpeechAPI();
    });
}

function stopRecording() {
  isRecording = false;
  const startVoiceButton = document.getElementById('startVoice');
  startVoiceButton.textContent = 'Start Voice';
  startVoiceButton.style.backgroundColor = '#00CED1 !important';
  startVoiceButton.style.color = 'white !important';
  startVoiceButton.style.borderColor = '#00CED1 !important';
  if (recognition) recognition.stop();
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  if (audioContext && audioContext.state !== 'closed') audioContext.close();
  clearInterval(countdownInterval);
  countdown = 60;
  document.getElementById('countdownDisplay').textContent = `00:${countdown}`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  stopThinkingText();
  
  const mood = document.getElementById('activityInput').value;
  console.log("Stopping - Transcript:", mood);
}

function update
