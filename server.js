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

    // Coba ambil ukuran file real
    if (data.download_link) {
      let fileSizeMb = null;

      // Cara 1: HEAD request
      try {
        const headRes = await axios.head(data.download_link, {
          timeout: 8000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const cl = headRes.headers['content-length'];
        if (cl) fileSizeMb = (parseInt(cl) / (1024 * 1024)).toFixed(1);
      } catch (e) {}

      // Cara 2: GET dengan Range jika HEAD gagal
      if (!fileSizeMb) {
        try {
          const rangeRes = await axios.get(data.download_link, {
            timeout: 8000,
            headers: { 'Range': 'bytes=0-0', 'User-Agent': 'Mozilla/5.0' },
            responseType: 'stream'
          });
          // Cek Content-Range: bytes 0-0/TOTAL
          const cr = rangeRes.headers['content-range'];
          if (cr) {
            const match = cr.match(/\/(\d+)$/);
            if (match) fileSizeMb = (parseInt(match[1]) / (1024 * 1024)).toFixed(1);
          }
          // Atau content-length di response
          const cl = rangeRes.headers['content-length'];
          if (!fileSizeMb && cl) fileSizeMb = (parseInt(cl) / (1024 * 1024)).toFixed(1);
          rangeRes.data.destroy();
        } catch (e) {}
      }

      if (fileSizeMb) data.file_size_mb = parseFloat(fileSizeMb);
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
