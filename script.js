
let audioContext, source, analyser;
const canvas = document.getElementById("waveform");
const ctx = canvas.getContext("2d");
const startVoiceBtn = document.getElementById("startVoice");
const activityInput = document.getElementById("activityInput");
const countdownDisplay = document.getElementById("countdownDisplay");
let animationId;
let countdownInterval;

function initWaveform(stream) {
  source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  source.connect(analyser);
  analyser.fftSize = 2048;

  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    animationId = requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0ff";
    ctx.beginPath();
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }
  draw();
}

function updateDateTime() {
  const now = new Date();
  document.getElementById("dateTimeDisplay").innerHTML =
    now.toLocaleDateString() + "<br>" + now.toLocaleTimeString();
}
setInterval(updateDateTime, 1000);

startVoiceBtn.addEventListener("click", async () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  initWaveform(stream);
  startCountdown();
});

function startCountdown() {
  let seconds = 60;
  countdownInterval = setInterval(() => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    countdownDisplay.textContent =
      `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    if (seconds-- <= 0) clearInterval(countdownInterval);
  }, 1000);
}
