const fs = require('fs');
const { google } = require('googleapis');
const ffmpeg = require('fluent-ffmpeg');

// Tarik Kunci dari Brankas
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

// 🎯 TANGKAP DATA (PAYLOAD) DARI VS CODE LOKAL LU
let payload = {};
try {
    payload = JSON.parse(process.env.PAYLOAD_DARI_HP || '{}');
} catch (e) {
    console.log("Payload kosong atau format salah");
}

// Gunakan data dari lokal, kalau kosong pakai default
const judul = payload.judulVideo || "Video Default Tanpa Payload";
const warna = payload.warnaBackground || "green"; 
const durasi = payload.durasi || 5;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

async function main() {
    console.log(`🎬 Menerima perintah dari lokal! Render warna: ${warna}, Durasi: ${durasi} detik`);
    const outputFilePath = './output_video.mp4';

    // Bikin video sesuai warna & durasi yang dikirim dari VS Code
    await new Promise((resolve, reject) => {
        ffmpeg()
        .input(`color=c=${warna}:s=720x1280:d=${durasi}`)
        .inputFormat('lavfi')
        .outputOptions(['-c:v libx264', '-pix_fmt yuv420p'])
        .save(outputFilePath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    console.log("🚀 Render selesai. Upload ke YouTube...");
    
    try {
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: judul,
                    description: "Video ini dirender otomatis sesuai request dinamis dari Klipika UI Lokal!",
                    tags: ['klipika', 'shorts', 'auto', 'bot'],
                    categoryId: '22'
                },
                status: { privacyStatus: 'private', selfDeclaredMadeForKids: false }
            },
            media: { body: fs.createReadStream(outputFilePath) }
        });
        console.log("🎉 SUCCESS, BRO! Link: https://youtu.be/" + res.data.id);
    } catch (error) {
        console.error("❌ Gagal upload:", error.message);
    }
}

main();
