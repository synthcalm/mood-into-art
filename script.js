const waveform = document.getElementById("waveform");
const dateTimeDisplay = document.getElementById("dateTimeDisplay");
const countdownDisplay = document.getElementById("countdownDisplay");

function drawWaveformGrid() {
  const ctx = waveform.getContext("2d");
  waveform.width = waveform.offsetWidth;
  waveform.height = waveform.offsetHeight;

  ctx.clearRect(0, 0, waveform.width, waveform.height);
  ctx.strokeStyle = "rgba(255, 255, 0, 0.3)";
  ctx.lineWidth = 1;

  for (let x = 0; x < waveform.width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, waveform.height);
    ctx.stroke();
  }
  for (let y = 0; y < waveform.height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(waveform.width, y);
    ctx.stroke();
  }
}

function updateDateTime() {
  const now = new Date();
  dateTimeDisplay.innerHTML = `${now.getDate()} ${now.toLocaleString("en-US", { month: "short" })} ${now.getFullYear()}<br>${now.toTimeString().split(" ")[0]}`;
}
setInterval(updateDateTime, 1000);

function startCountdown(duration = 60) {
  let seconds = duration;
  const interval = setInterval(() => {
    countdownDisplay.textContent = `00:${String(seconds).padStart(2, "0")}`;
    if (seconds-- <= 0) clearInterval(interval);
  }, 1000);
}

window.onload = () => {
  drawWaveformGrid();
  updateDateTime();
  startCountdown();
};
