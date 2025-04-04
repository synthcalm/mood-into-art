document.getElementById('startVoice').addEventListener('click', () => {
  alert('Microphone and transcription not yet fully wired up.');
});
document.getElementById('redo').addEventListener('click', () => {
  document.getElementById('activityInput').value = '';
  document.getElementById('styleSelect').value = 'none';
  document.getElementById('generatedImage').style.display = 'none';
});
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
