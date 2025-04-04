let isRecording = false;
let socket;
let audioContext;
let mediaRecorder;

// Voice Recording Functions
async function startVoiceRecording() {
  try {
    // Get AssemblyAI token
    const tokenResponse = await fetch('/assemblyai-token');
    const { token } = await tokenResponse.json();
    
    // Initialize WebSocket
    socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?token=${token}`);
    
    // Set up microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    const microphone = audioContext.createMediaStreamSource(stream);
    
    // Audio processor setup
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    microphone.connect(processor);
    processor.connect(audioContext.destination);
    
    processor.onaudioprocess = (e) => {
      const audioData = e.inputBuffer.getChannelData(0);
      const int16Array = floatTo16BitPCM(audioData);
      const base64String = arrayBufferToBase64(int16Array.buffer);
      
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ audio_data: base64String }));
      }
    };

    // WebSocket handlers
    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.text) {
        document.getElementById('activityInput').value += data.text + ' ';
      }
    };

    socket.onopen = () => {
      isRecording = true;
      document.getElementById('startVoice').textContent = 'Stop Voice';
    };

    socket.onclose = () => {
      isRecording = false;
      document.getElementById('startVoice').textContent = 'Start Voice';
    };

  } catch (error) {
    console.error('Error:', error);
    alert('Error accessing microphone. Please check permissions.');
  }
}

function stopVoiceRecording() {
  if (socket) socket.close();
  if (audioContext) audioContext.close();
  isRecording = false;
  document.getElementById('startVoice').textContent = 'Start Voice';
}

// Audio conversion helpers
function floatTo16BitPCM(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Event Listeners
document.getElementById('startVoice').addEventListener('click', () => {
  if (isRecording) {
    stopVoiceRecording();
  } else {
    startVoiceRecording();
  }
});

document.getElementById('redo').addEventListener('click', () => {
  stopVoiceRecording();
  document.getElementById('activityInput').value = '';
  document.getElementById('styleSelect').value = 'none';
  document.getElementById('generatedImage').style.display = 'none';
});

// Keep the rest of your existing code for generate/save/image handling
document.getElementById('generate').addEventListener('click', () => {
  const mood = document.getElementById('activityInput').value;
  const style = document.getElementById('styleSelect').value;
  if (mood && style !== 'none') {
    document.getElementById('generatedImage').src = 'https://via.placeholder.com/500x500.png?text=Generated+Image';
    document.getElementById('generatedImage').style.display = 'block';
    const history = document.getElementById('moodHistory');
    const entry = document.createElement('div');
    entry.textContent = `${new Date().toLocaleString()} — ${mood} [${style}]`;
    history.prepend(entry);
  } else {
    alert('Please enter a mood and choose a style.');
  }
});

document.getElementById('saveImage').addEventListener('click', () => {
  const image = document.getElementById('generatedImage');
  if (image.src) {
    const a = document.createElement('a');
    a.href = image.src;
    a.download = 'mood-art.png';
    a.click();
  }
});

setInterval(() => {
  const now = new Date();
  document.getElementById('dateTimeDisplay').textContent =
    now.toLocaleDateString('en-US') + '\n' + now.toLocaleTimeString('en-US');
}, 1000);
