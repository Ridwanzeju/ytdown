const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve index.html dari root folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API proxy endpoint — hindari CORS + ambil ukuran file real
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

    const data = response.data;

    // Cek ukuran file real dari download_link via HEAD request
    if (data.download_link) {
      try {
        const headRes = await axios.head(data.download_link, { timeout: 8000 });
        const contentLength = headRes.headers['content-length'];
        if (contentLength) {
          const mb = (parseInt(contentLength) / (1024 * 1024)).toFixed(1);
          data.file_size_mb = parseFloat(mb);
        }
      } catch (headErr) {
        // Kalau HEAD gagal, tidak apa-apa, lanjut tanpa ukuran
        console.log('HEAD request gagal:', headErr.message);
      }
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

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
