const fs = require('fs');
const { google } = require('googleapis');
const ffmpeg = require('fluent-ffmpeg');

// Tarik Kunci dari Brankas
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

// 🎯 TANGKAP DATA (PAYLOAD) DARI UI KLIPIKA
let payload = {};
try {
    payload = JSON.parse(process.env.PAYLOAD_DARI_HP || '{}');
} catch (e) {
    console.log("Payload kosong atau format salah");
}

const judul = payload.judulVideo || "Video Auto Render";
const deskripsi = payload.deskripsiVideo || "Deskripsi otomatis dari Klipika.";
const imageUrl = payload.gambarUrl || "https://images.pexels.com/photos/3944688/pexels-photo-3944688.jpeg?auto=compress&cs=tinysrgb&w=720&h=1280&dpr=1";
const durasi = payload.durasi || 6;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

// Fungsi sakti buat narik gambar dari internet ke server GitHub
async function downloadImage(url, filepath) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Gagal download gambar: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filepath, buffer);
}

async function main() {
    console.log(`🎬 Menerima instruksi! URL Gambar: ${imageUrl}`);
    const outputFilePath = './output_video.mp4';
    const tempImgPath = './temp_image.jpg';

    try {
        console.log("⬇️ Sedang mendownload gambar dari URL...");
        await downloadImage(imageUrl, tempImgPath);
        console.log("✅ Gambar berhasil didownload ke server!");

        console.log(`🎥 Merender video durasi ${durasi} detik...`);
        // Mesin FFmpeg menjahit gambar statis jadi video Shorts
        await new Promise((resolve, reject) => {
            ffmpeg()
            .input(tempImgPath)
            .inputOptions(['-loop 1'])
            .outputOptions([
                '-c:v libx264',
                '-t ' + durasi,
                '-pix_fmt yuv420p',
                // Script ini maksa gambarnya di-zoom & di-crop jadi vertikal pas 9:16
                '-vf scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1'
            ])
            .save(outputFilePath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
        });
        console.log("✅ Render video selesai!");

        console.log("🚀 Memulai upload ke YouTube...");
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: judul,
                    description: deskripsi,
                    tags: ['klipika', 'shorts', 'auto', 'news'],
                    categoryId: '22'
                },
                status: { privacyStatus: 'private', selfDeclaredMadeForKids: false }
            },
            media: { body: fs.createReadStream(outputFilePath) }
        });
        console.log("🎉 SUCCESS, BRO! Link: https://youtu.be/" + res.data.id);
        
    } catch (error) {
        console.error("❌ ERROR FATAL:", error.message);
    }
}

main();
