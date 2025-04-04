// Check for SpeechRecognition API support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;
let socket = null;
let countdown = 60; // 60 seconds max recording time
let countdownInterval = null;

// Speech Recognition Setup
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true; // Continuous listening
  recognition.interimResults = true; // Show interim results
  recognition.lang = 'en-US'; // Set language

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');
    document.getElementById('activityInput').value = transcript;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    alert(`Speech recognition error: ${event.error}`);
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording) {
      recognition.start(); // Restart if still recording
    }
  };
} else {
  console.warn('Speech recognition not supported in this browser. Falling back to AssemblyAI.');
}

// Waveform visualization setup
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
      console.error('Microphone access error:', err);
      alert('Failed to access microphone. Please ensure permissions are granted.');
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
  ctx.strokeStyle = '#ff0'; // Yellow waveform
  ctx.beginPath();

  const sliceWidth = canvas.width / dataArray.length;
  let x = 0;

  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * canvas.height) / 2;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
}

// AssemblyAI Fallback for Transcription
async function setupAssemblyAI() {
  try {
    const response = await fetch('https://your-backend.onrender.com/assemblyai-token'); // Replace with your actual backend URL
    if (!response.ok) throw new Error('Failed to fetch AssemblyAI token');
    const { token } = await response.json();

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
          mediaRecorder.start(250); // Send audio chunks every 250ms
        })
        .catch(err => {
          console.error('Microphone access error for AssemblyAI:', err);
          alert('Failed to access microphone for AssemblyAI. Please ensure permissions are granted.');
          stopRecording();
        });
    };

    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.text) {
        document.getElementById('activityInput').value = data.text;
      }
    };

    socket.onerror = (error) => {
      console.error('AssemblyAI WebSocket error:', error);
      alert('Error with AssemblyAI transcription.');
      stopRecording();
    };

    socket.onclose = () => {
      socket = null;
    };
  } catch (error) {
    console.error('Error setting up AssemblyAI:', error);
    alert('Failed to set up AssemblyAI transcription.');
    stopRecording();
  }
}

// Countdown Timer
function updateCountdown() {
  countdown--;
  document.getElementById('countdownDisplay').textContent = `00:${countdown.toString().padStart(2, '0')}`;
  if (countdown <= 0) {
    stopRecording();
  }
}

function startRecording() {
  navigator.permissions.query({ name: 'microphone' })
    .then(permissionStatus => {
      if (permissionStatus.state === 'granted') {
        isRecording = true;
        document.getElementById('startVoice').textContent = 'Stop Voice';
        countdown = 60;
        document.getElementById('countdownDisplay').textContent = `00:${countdown.toString().padStart(2, '0')}`;
        countdownInterval = setInterval(updateCountdown, 1000);

        if (recognition) {
          recognition.start();
        } else {
          setupAssemblyAI();
        }
        setupWaveform();
      } else if (permissionStatus.state === 'prompt') {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(() => {
            isRecording = true;
            document.getElementById('startVoice').textContent = 'Stop Voice';
            countdown = 60;
            document.getElementById('countdownDisplay').textContent = `00:${countdown.toString().padStart(2, '0')}`;
            countdownInterval = setInterval(updateCountdown, 1000);

            if (recognition) {
              recognition.start();
            } else {
              setupAssemblyAI();
            }
            setupWaveform();
          })
          .catch(err => {
            console.error('Microphone access denied:', err);
            alert('Microphone access denied.');
          });
      } else {
        alert('Microphone access denied. Please enable it in your browser settings.');
      }
    })
    .catch(err => {
      console.error('Permission query error:', err);
      alert('Error checking microphone permissions.');
    });
}

function stopRecording() {
  isRecording = false;
  document.getElementById('startVoice').textContent = 'Start Voice';
  if (recognition) recognition.stop();
  if (socket) socket.close();
  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().then(() => {
      audioContext = null; // Reset audioContext after closing
    });
  }
  if (countdownInterval) clearInterval(countdownInterval);
  countdown = 60;
  document.getElementById('countdownDisplay').textContent = `00:${countdown.toString().padStart(2, '0')}`;
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear waveform
}

// Start/Stop voice recording
document.getElementById('startVoice').addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});

// Redo functionality
document.getElementById('redo').addEventListener('click', () => {
  stopRecording();
  document.getElementById('activityInput').value = '';
  document.getElementById('styleSelect').value = 'none';
  document.getElementById('generatedImage').style.display = 'none';
});

// Generate image
document.getElementById('generate').addEventListener('click', async () => {
  const mood = document.getElementById('activityInput').value;
  const style = document.getElementById('styleSelect').value;
  if (mood && style !== 'none') {
    try {
      const response = await fetch('https://your-backend.onrender.com/generate
