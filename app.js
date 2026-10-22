const fs = require('fs');
const { google } = require('googleapis');
const ffmpeg = require('fluent-ffmpeg');

// 1. Tarik Kunci Sakti dari Brankas GitHub
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

// Setup Koneksi ke YouTube
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

async function main() {
    console.log("🎬 Tahap 1: Memulai proses render video dengan FFmpeg...");
    const outputFilePath = './output_video.mp4';

    // Bikin video Polos (Warna Biru) durasi 5 Detik ukuran Vertikal 9:16 untuk ngetes render
    await new Promise((resolve, reject) => {
        ffmpeg()
        .input('color=c=blue:s=720x1280:d=5')
        .inputFormat('lavfi')
        .outputOptions(['-c:v libx264', '-pix_fmt yuv420p'])
        .save(outputFilePath)
        .on('end', () => {
            console.log("✅ Render Video Selesai!");
            resolve();
        })
        .on('error', (err) => {
            console.error("❌ Gagal render:", err);
            reject(err);
        });
    });

    console.log("🚀 Tahap 2: Mulai upload otomatis ke YouTube Shorts...");
    
    try {
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: "Testing Klipika Cloud Render 🔥",
                    description: "Video ini dirender dan diupload otomatis 100% dari mesin GitHub Actions tanpa HP meledak!",
                    tags: ['klipika', 'shorts', 'auto', 'bot'],
                    categoryId: '22'
                },
                status: {
                    privacyStatus: 'private', // Sengaja diset PRIVATE dulu buat ngetes biar aman!
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(outputFilePath)
            }
        });
        console.log("🎉 SUCCESS, BRO! Video berhasil mendarat di YouTube!");
        console.log("🔗 Cek Studio YouTube lu atau klik link ini: https://youtu.be/" + res.data.id);
    } catch (error) {
        console.error("❌ Waduh, gagal upload:", error.message);
    }
}

main();
