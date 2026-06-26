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
      `yt-dlp --no-playlist -j --skip-download "${safeUrl}"`,
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

/* ===== YOUTUBE DOWNLOAD (video atau audio) ===== */
app.get('/api/youtube/download', async (req, res) => {
  const url = req.query.url;
  const format = req.query.format || 'mp4'; // 'mp4' atau 'mp3'
  const quality = req.query.quality || '720'; // 360/480/720/1080
  const bitrate = req.query.bitrate || '128'; // untuk mp3

  if (!url) return res.status(400).json({ status: 'error', message: 'url parameter is required' });

  try {
    const safeUrl = url.replace(/'/g, "");
    let cmd;

    if (format === 'mp3') {
      cmd = `yt-dlp --no-playlist -f bestaudio --extract-audio --audio-format mp3 --audio-quality ${bitrate}K -g "${safeUrl}"`;
    } else {
      const heightMap = { '360': 360, '480': 480, '720': 720, '1080': 1080 };
      const h = heightMap[quality] || 720;
      cmd = `yt-dlp --no-playlist -f "bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${h}][ext=mp4]/best" -g "${safeUrl}"`;
    }

    const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10, timeout: 45000 });
    const links = stdout.trim().split('\n').filter(Boolean);
    const directLink = links[links.length - 1]; // ambil link terakhir (biasanya video+audio sudah merged jika -g return 1 link, atau video saja)

    if (!directLink) {
      return res.status(500).json({ status: 'error', message: 'Gagal mendapatkan link download.' });
    }

    // Ambil judul untuk nama file
    const { stdout: titleOut } = await execAsync(
      `yt-dlp --no-playlist --get-title "${safeUrl}"`,
      { timeout: 20000 }
    );
    const title = titleOut.trim().replace(/[^\w\s-]/gi, '').slice(0, 80);
    const ext = format === 'mp3' ? 'mp3' : 'mp4';
    const filename = `${title}_${format === 'mp3' ? bitrate + 'kbps' : quality + 'p'}.${ext}`;

    res.json({
      status: 'success',
      download_link: directLink,
      filename: filename
    });
  } catch (err) {
    console.error('YouTube download error:', err.message);
    res.status(500).json({ status: 'error', message: 'Gagal memproses video. Coba kualitas lain atau link lain.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
