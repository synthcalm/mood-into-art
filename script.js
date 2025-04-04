// Initialize canvas for waveform
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');
let socket, audioContext, processor, stream;

// Function to draw waveform
function drawWaveform(audioData) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.strokeStyle = '#0ff';
  const sliceWidth = canvas.width / audioData.length;
  let x = 0;

  for (let i = 0; i < audioData.length; i++) {
    const y = (audioData[i] * canvas.height) / 2 + canvas.height / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.stroke();
}

// Start Voice button: Initialize microphone and AssemblyAI WebSocket
document.getElementById('startVoice').addEventListener('click', async () => {
  try {
    // Fetch AssemblyAI token from backend
    const response = await fetch('/assemblyai-token');
    if (!response.ok) throw new Error('Failed to get AssemblyAI token');
    const { token } = await response.json();

    // Initialize WebSocket for real-time transcription
    socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`);

    socket.onopen = async () => {
      console.log('WebSocket connected');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        const audioData = e.inputBuffer.getChannelData(0);
        socket.send(new Float32Array(audioData).buffer); // Send audio to AssemblyAI
        drawWaveform(audioData); // Draw waveform
      };

      startCountdown(60); // Start 60-second countdown
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.message_type === 'FinalTranscript' && data.text) {
        document.getElementById('activityInput').value = data.text; // Update textarea
      }
    };

    socket.onerror = (error) => console.error('WebSocket error:', error);
    socket.onclose = () => console.log('WebSocket closed');
  } catch (error) {
    console.error('Error starting voice:', error);
    alert('Failed to start voice transcription. Check console for details.');
  }
});

// Redo button: Clear inputs and reset UI
document.getElementById('redo').addEventListener('click', () => {
  if (socket) socket.close();
  if (audioContext) audioContext.close();
  if (stream) stream.getTracks().forEach(track => track.stop());
  document.getElementById('activityInput').value = '';
  document.getElementById('styleSelect').value = 'none';
  document.getElementById('generatedImage').style.display = 'none';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  clearInterval(countdown);
  document.getElementById('countdownDisplay').textContent = '00:60';
});

// Generate button: Fetch image from backend
document.getElementById('generate').addEventListener('click', async () => {
  const mood = document.getElementById('activityInput').value;
  const style = document.getElementById('styleSelect').value;
  if (mood && style !== 'none') {
    try {
      const response = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${mood} in ${style} style` }),
      });
      if (!response.ok) throw new Error('Failed to generate image');
      const { image } = await response.json();
      document.getElementById('generatedImage').src = `data:image/png;base64,${image}`;
      document.getElementById('generatedImage').style.display = 'block';

      const history = document.getElementById('moodHistory');
      const entry = document.createElement('div');
      entry.textContent = `${new Date().toLocaleString()} — ${mood} [${style}]`;
      history.prepend(entry);
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Image generation failed. Check console for details.');
    }
  } else {
    alert('Please enter a mood and choose a style.');
  }
});

// Save Image button: Download generated image
document.getElementById('saveImage').addEventListener('click', () => {
  const image = document.getElementById('generatedImage');
  if (image.src && image.style.display !== 'none') {
    const a = document.createElement('a');
    a.href = image.src;
    a.download = 'mood-art.png';
    a.click();
  } else {
    alert('No image to save. Generate an image first.');
  }
});

// Date and time display
setInterval(() => {
  const now = new Date();
  document.getElementById('dateTimeDisplay').textContent =
    now.toLocaleDateString('en-US') + '\n' + now.toLocaleTimeString('en-US');
}, 1000);

// Countdown timer
let countdown;
function startCountdown(seconds) {
  let timeLeft = seconds;
  document.getElementById('countdownDisplay').textContent = `00:${timeLeft.toString().padStart(2, '0')}`;
  countdown = setInterval(() => {
    timeLeft--;
    document.getElementById('countdownDisplay').textContent = `00:${timeLeft.toString().padStart(2, '0')}`;
    if (timeLeft <= 0) {
      clearInterval(countdown);
      if (socket) socket.close();
      if (audioContext) audioContext.close();
      if (stream) stream.getTracks().forEach(track => track.stop());
    }
  }, 1000);
}
