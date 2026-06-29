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

/* ===== YOUTUBE INFO (judul, thumbnail, durasi) ===== */
app.get('/api/youtube/info', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ status: 'error', message: 'url parameter is required' });

  try {
    const safeUrl = url.replace(/'/g, "");
    const { stdout } = await execAsync(
      `python3 -m yt_dlp --no-playlist -j --skip-download "${safeUrl}"`,
      { maxBuffer: 1024 * 1024 * 10, timeout: 30000 }
    );
    const info = JSON.parse(stdout);
    res.json({
      status: 'success',
      title: info.title || 'Video YouTube',
      author: info.uploader || info.channel || '—',
      thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`,
      duration: info.duration || 0
    });
  } catch (err) {
    console.error('YouTube info error:', err.message);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil info video. Pastikan link benar dan video publik.' });
  }
});

const { spawn } = require('child_process');

/* ===== YOUTUBE DOWNLOAD (video atau audio) — STREAMING LANGSUNG ===== */
app.get('/api/youtube/download', async (req, res) => {
  const url = req.query.url;
  const format = req.query.format || 'mp4'; // 'mp4' atau 'mp3'
  const quality = req.query.quality || '720'; // 360/480/720/1080
  const bitrate = req.query.bitrate || '128'; // untuk mp3

  if (!url) return res.status(400).json({ status: 'error', message: 'url parameter is required' });

  const safeUrl = url.replace(/'/g, "");
  let titleSafe = 'video';

  try {
    const { stdout: titleOut } = await execAsync(
      `python3 -m yt_dlp --no-playlist --get-title "${safeUrl}"`,
      { timeout: 20000 }
    );
    titleSafe = titleOut.trim().replace(/[^\w\s-]/gi, '').slice(0, 80) || 'video';
  } catch (e) { /* pakai default 'video' kalau gagal ambil judul */ }

  const ext = format === 'mp3' ? 'mp3' : 'mp4';
  const filename = `${titleSafe}_${format === 'mp3' ? bitrate + 'kbps' : quality + 'p'}.${ext}`;

  let args;
  if (format === 'mp3') {
    args = [
      '-m', 'yt_dlp', '--no-playlist',
      '-f', 'bestaudio',
      '--extract-audio', '--audio-format', 'mp3', '--audio-quality', `${bitrate}K`,
      '-o', '-', safeUrl
    ];
  } else {
    const heightMap = { '360': 360, '480': 480, '720': 720, '1080': 1080 };
    const h = heightMap[quality] || 720;
    args = [
      '-m', 'yt_dlp', '--no-playlist',
      '-f', `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${h}][ext=mp4]/best`,
      '--merge-output-format', 'mp4',
      '-o', '-', safeUrl
    ];
  }

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');

  const ytdlp = spawn('python3', args);
  let responded = false;

  ytdlp.stdout.pipe(res);

  ytdlp.stderr.on('data', (data) => {
    console.error('yt-dlp stderr:', data.toString());
  });

  ytdlp.on('error', (err) => {
    console.error('YouTube stream spawn error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ status: 'error', message: 'Gagal memulai proses download.' });
    }
  });

  ytdlp.on('close', (code) => {
    if (code !== 0 && !res.writableEnded) {
      console.error(`yt-dlp exited with code ${code}`);
    }
  });

  req.on('close', () => {
    ytdlp.kill('SIGKILL'); // hentikan proses kalau user batalkan/tutup koneksi
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
