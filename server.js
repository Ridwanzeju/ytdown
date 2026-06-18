const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve index.html dari root folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API proxy endpoint
app.get('/api/download', async (req, res) => {
  const { url, quality = '720' } = req.query;

  if (!url) {
    return res.status(400).json({ status: 'error', message: 'Parameter url wajib diisi.' });
  }

  try {
    const apiUrl = 'https://api.sonzaix.indevs.in/youtube/download';
    const response = await axios.get(apiUrl, {
      params: { url, format: 'mp4', quality, audioBitrate: '128', vCodec: 'h264' },
      timeout: 15000,
    });

    const data = response.data;

    // Ambil durasi video dari YouTube oEmbed API (gratis, tanpa key)
    if (url) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const oembedRes = await axios.get(oembedUrl, { timeout: 5000 });
        // oEmbed tidak ada durasi, pakai ytdl info sebagai fallback
      } catch (e) {}

      // Coba ambil durasi dari halaman YouTube langsung
      try {
        const ytRes = await axios.get(`https://www.youtube.com/watch?v=${extractVideoId(url)}`, {
          timeout: 8000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const durationMatch = ytRes.data.match(/"lengthSeconds":"(\d+)"/);
        if (durationMatch) {
          data.duration_seconds = parseInt(durationMatch[1]);
        }
      } catch (e) {}
    }

    return res.json(data);
  } catch (err) {
    console.error('API Error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data dari API. Coba lagi.',
    });
  }
});

function extractVideoId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
