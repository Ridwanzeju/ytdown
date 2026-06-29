const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve index.html dari root folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ===== YOUTUBE INFO (judul, thumbnail) — via Sonzai X API ===== */
app.get('/api/youtube/info', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ status: 'error', message: 'url parameter is required' });

  try {
    const apiUrl = `https://api.sonzaix.indevs.in/youtube/info?url=${encodeURIComponent(url)}`;
    const apiRes = await fetch(apiUrl);
    const data = await apiRes.json();

    if (!data || data.status !== 'success') {
      return res.status(500).json({ status: 'error', message: 'Gagal mengambil info video. Pastikan link benar dan video publik.' });
    }

    res.json({
      status: 'success',
      title: data.title || 'Video YouTube',
      author: data.author || '—',
      thumbnail: data.thumbnail || '',
      duration: data.duration || 0
    });
  } catch (err) {
    console.error('YouTube info error:', err.message);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil info video. Pastikan link benar dan video publik.' });
  }
});

const { Readable } = require('stream');

/* ===== YOUTUBE DOWNLOAD (video atau audio) — via Sonzai X API, di-proxy ===== */
app.get('/api/youtube/download', async (req, res) => {
  const url = req.query.url;
  const format = req.query.format || 'mp4'; // 'mp4' atau 'mp3'
  const quality = req.query.quality || '720'; // 360/480/720/1080
  const bitrate = req.query.bitrate || '128'; // untuk mp3

  if (!url) return res.status(400).json({ status: 'error', message: 'url parameter is required' });

  try {
    let apiUrl;
    if (format === 'mp3') {
      apiUrl = `https://api.sonzaix.indevs.in/youtube/download?url=${encodeURIComponent(url)}&format=mp3&audioBitrate=${bitrate}`;
    } else {
      apiUrl = `https://api.sonzaix.indevs.in/youtube/download?url=${encodeURIComponent(url)}&format=mp4&quality=${quality}&audioBitrate=128&vCodec=h264`;
    }

    const apiRes = await fetch(apiUrl);

    if (!apiRes.ok || !apiRes.body) {
      return res.status(500).json({ status: 'error', message: 'Gagal mengambil file dari penyedia. Coba lagi nanti.' });
    }

    const ext = format === 'mp3' ? 'mp3' : 'mp4';
    res.setHeader('Content-Disposition', `attachment; filename="video.${ext}"`);
    res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');

    // apiRes.body dari fetch() native adalah WHATWG ReadableStream,
    // perlu dikonversi ke Node stream dulu sebelum .pipe()
    const nodeStream = Readable.fromWeb(apiRes.body);
    nodeStream.pipe(res);

    nodeStream.on('error', (err) => {
      console.error('Proxy stream error:', err.message);
      if (!res.writableEnded) res.end();
    });

    req.on('close', () => {
      nodeStream.destroy();
    });
  } catch (err) {
    console.error('YouTube download error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ status: 'error', message: 'Gagal memulai proses download.' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
