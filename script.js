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
  ctx.strokeStyle = '#0ff';
  ctx.shadowColor = '#0ff';
  ctx.shadowBlur = 10;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round'; // Yellow waveform
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
    const response = await fetch('/assemblyai-token');
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
  
try {
  navigator.permissions.query({ name: 'microphone' })
    .then(permissionStatus => {
      if (permissionStatus.state === 'granted') {
        startStreamAndRecording();
      } else if (permissionStatus.state === 'prompt') {
        askForMicrophoneAccess();
      } else {
        alert('Microphone access denied.');
      }
    })
    .catch(() => {
      askForMicrophoneAccess();
    });
} catch {
  askForMicrophoneAccess();
}

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
    audioContext.close().catch(e => console.warn('AudioContext close error:', e));
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
      const response = await fetch('https://mood-into-art-backend.onrender.com/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${mood} in ${style} style` }),
      });
      if (!response.ok) throw new Error('Failed to generate image');
      const data = await response.json();
      if (data.image) {
        document.getElementById('generatedImage').src = `data:image/png;base64,${data.image}`;
        document.getElementById('generatedImage').style.display = 'block';

        // Log mood history
        const history = document.getElementById('moodHistory');
        const entry = document.createElement('div');
        entry.style.display = 'flex';
        entry.style.justifyContent = 'space-between';
        entry.style.alignItems = 'center';
        entry.style.marginBottom = '5px';

        const text = document.createElement('span');
        text.textContent = `${new Date().toLocaleString()} — ${mood} [${style}]`;
        entry.appendChild(text);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.background = '#000';
        deleteBtn.style.color = '#0ff';
        deleteBtn.style.border = '1px solid #0ff';
        deleteBtn.style.padding = '2px 5px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.addEventListener('click', () => {
          history.removeChild(entry);
        });
        entry.appendChild(deleteBtn);

        history.prepend(entry);
      } else {
        alert('Failed to generate image.');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Error generating image. Please try again.');
    }
  } else {
    alert('Please enter a mood and choose a style.');
  }
});

// Save image
document.getElementById('saveImage').addEventListener('click', () => {
  const image = document.getElementById('generatedImage');
  if (image.src) {
    const a = document.createElement('a');
    a.href = image.src;
    a.download = 'mood-art.png';
    a.click();
  } else {
    alert('No image to save. Please generate an image first.');
  }
});

// Update date and time
setInterval(() => {
  const now = new Date();
  document.getElementById('dateTimeDisplay').textContent =
    now.toLocaleDateString('en-US') + '\n' + now.toLocaleTimeString('en-US');
}, 1000);


function askForMicrophoneAccess() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => startStreamAndRecording())
    .catch(err => {
      console.error('Mic denied:', err);
      alert('Microphone access denied.');
    });
}

function startStreamAndRecording() {
  isRecording = true;
  document.getElementById('startVoice').textContent = 'Stop Voice';
  countdown = 60;
  document.getElementById('countdownDisplay').textContent = `00:${countdown.toString().padStart(2, '0')}`;
  countdownInterval = setInterval(updateCountdown, 1000);

  if (recognition) recognition.start();
  else setupAssemblyAI();

  setupWaveform();
}
