// Generate image
document.getElementById('generate').addEventListener('click', async () => {
  const mood = document.getElementById('activityInput').value;
  const style = document.getElementById('styleSelect').value;

  console.log(`🟡 Generate button clicked — Mood: "${mood}", Style: "${style}"`);

  if (mood && style !== 'none') {
    try {
      console.log('🟢 Sending prompt to backend:', `${mood} in ${style} style`);

      const response = await fetch('https://mood-into-art-backend.onrender.com/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${mood} in ${style} style` }),
      });

      console.log('🟢 Backend responded with status:', response.status);

      if (!response.ok) throw new Error('Failed to generate image');
      const data = await response.json();

      console.log('🟢 Data received from backend:', data);

      if (data.image) {
        console.log('✅ Image received — displaying on UI');
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
        console.warn('⚠️ No image found in response');
        alert('Failed to generate image.');
      }
    } catch (error) {
      console.error('❌ Error generating image:', error);
      alert('Error generating image. Please try again.');
    }
  } else {
    console.warn('⚠️ Mood or style missing');
    alert('Please enter a mood and choose a style.');
  }
});
