const fs = require('fs');
const { google } = require('googleapis');
const ffmpeg = require('fluent-ffmpeg');

// Tarik Kunci dari Brankas
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

// 🎯 TANGKAP DATA (PAYLOAD) DARI UI KLIPIKA (Cloudflare/Lokal)
let payload = {};
try {
    payload = JSON.parse(process.env.PAYLOAD_DARI_HP || '{}');
} catch (e) {
    console.log("Payload kosong atau format salah");
}

// Gunakan data dari UI Klipika, kalau kosong pakai default
const judul = payload.judulVideo || "Judul Default (Payload Gagal Masuk)";
const deskripsi = payload.deskripsiVideo || "Deskripsi default (Payload Gagal Masuk).";
const warna = payload.warnaBackground || "blue"; 
const durasi = payload.durasi || 5;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

async function main() {
    console.log(`🎬 Menerima perintah dari Klipika UI! Render warna: ${warna}, Durasi: ${durasi} detik`);
    const outputFilePath = './output_video.mp4';

    // Bikin video sesuai warna & durasi yang dikirim dari UI
    await new Promise((resolve, reject) => {
        ffmpeg()
        .input(`color=c=${warna}:s=720x1280:d=${durasi}`)
        .inputFormat('lavfi')
        .outputOptions(['-c:v libx264', '-pix_fmt yuv420p'])
        .save(outputFilePath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    console.log("🚀 Render video selesai. Memulai upload ke YouTube...");
    
    try {
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: judul,
                    description: deskripsi,
                    tags: ['klipika', 'shorts', 'auto', 'news'],
                    categoryId: '22'
                },
                status: { 
                    privacyStatus: 'private', // Tetap private untuk uji coba
                    selfDeclaredMadeForKids: false 
                }
            },
            media: { body: fs.createReadStream(outputFilePath) }
        });
        console.log("🎉 SUCCESS, BRO! Video berhasil mendarat di YouTube!");
        console.log("🔗 Cek Studio YouTube lu atau klik link ini: https://youtu.be/" + res.data.id);
    } catch (error) {
        console.error("❌ Gagal upload:", error.message);
    }
}

main();
