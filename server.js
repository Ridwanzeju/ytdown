const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// API proxy endpoint — hindari CORS
app.get('/api/download', async (req, res) => {
  const { url, quality = '720' } = req.query;

  if (!url) {
    return res.status(400).json({ status: 'error', message: 'Parameter url wajib diisi.' });
  }

  try {
    const apiUrl = 'https://api.sonzaix.indevs.in/youtube/download';
    const response = await axios.get(apiUrl, {
      params: {
        url,
        format: 'mp4',
        quality,
        audioBitrate: '128',
        vCodec: 'h264',
      },
      timeout: 15000,
    });

    return res.json(response.data);
  } catch (err) {
    console.error('API Error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data dari API. Coba lagi.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
