
// Voice recording and waveform visualization setup
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let countdownInterval;

document.addEventListener("DOMContentLoaded", () => {
  const startVoiceButton = document.getElementById('startVoice');
  const redoButton = document.getElementById('redo');
  const generateButton = document.getElementById('generate');
  const saveImageButton = document.getElementById('saveImage');
  const activityInput = document.getElementById('activityInput');
  const styleSelect = document.getElementById('styleSelect');
  const generatedImage = document.getElementById('generatedImage');
  const countdownDisplay = document.getElementById('countdownDisplay');

  startVoiceButton.addEventListener('click', async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          // You can upload this blob to your backend for transcription
          console.log('Audio recorded. Ready to send to transcription service.');
        };

        mediaRecorder.start();
        isRecording = true;
        startVoiceButton.textContent = 'Stop Voice';
        startCountdown();

      } catch (err) {
        alert('Microphone access denied.');
        console.error(err);
      }
    } else {
      mediaRecorder.stop();
      isRecording = false;
      startVoiceButton.textContent = 'Start Voice';
      clearInterval(countdownInterval);
      countdownDisplay.textContent = '00:60';
    }
  });

  redoButton.addEventListener('click', () => {
    activityInput.value = '';
    styleSelect.value = 'none';
    generatedImage.style.display = 'none';
  });

  generateButton.addEventListener('click', () => {
    const mood = activityInput.value;
    const style = styleSelect.value;
    if (mood && style !== 'none') {
      generatedImage.src = 'https://via.placeholder.com/1080x1080.png?text=Generated+Image';
      generatedImage.style.display = 'block';
    } else {
      alert('Please enter a mood and choose a style.');
    }
  });

  saveImageButton.addEventListener('click', () => {
    const image = generatedImage;
    if (image.src && image.style.display !== 'none') {
      const a = document.createElement('a');
      a.href = image.src;
      a.download = 'mood-art.png';
      a.click();
    }
  });

  function startCountdown() {
    let seconds = 60;
    countdownDisplay.textContent = '01:00';
    countdownInterval = setInterval(() => {
      seconds--;
      const min = String(Math.floor(seconds / 60)).padStart(2, '0');
      const sec = String(seconds % 60).padStart(2, '0');
      countdownDisplay.textContent = `${min}:${sec}`;
      if (seconds <= 0) {
        clearInterval(countdownInterval);
        if (isRecording && mediaRecorder) {
          mediaRecorder.stop();
          isRecording = false;
          startVoiceButton.textContent = 'Start Voice';
        }
      }
    }, 1000);
  }
});
