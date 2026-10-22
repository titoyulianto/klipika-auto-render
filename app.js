const fs = require('fs');
const { google } = require('googleapis');

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

let payload = {};
try { payload = JSON.parse(process.env.PAYLOAD_DARI_HP || '{}'); } 
catch (e) { console.log("Payload kosong"); }

const judul = payload.judulVideo || "Video Otomatis Klipika";
const deskripsi = payload.deskripsiVideo || "Generated 100% dari Cloud Klipika.";
const finalVideoUrl = payload.finalVideoUrl; // Ini link video matang dari HP lu

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

async function main() {
    if (!finalVideoUrl) {
        return console.error("❌ ERROR: Tidak ada URL video final yang diterima dari Klipika.");
    }

    const videoPath = './video_matang.webm'; // WebM adalah format asli rekaman Klipika

    try {
        console.log(`📥 Mendownload video matang dari Klipika...`);
        const response = await fetch(finalVideoUrl);
        if (!response.ok) throw new Error("Gagal download video dari jembatan cloud.");
        
        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(videoPath, Buffer.from(arrayBuffer));
        console.log("✅ Video matang berhasil diamankan di server GitHub.");

        console.log("🚀 Langsung mengunggah ke YouTube...");
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: { title: judul, description: deskripsi, categoryId: '22' },
                status: { privacyStatus: 'private', selfDeclaredMadeForKids: false }
            },
            media: { body: fs.createReadStream(videoPath) }
        });
        console.log("🎉 SUCCESS, BRO! Link YouTube lu: https://youtu.be/" + res.data.id);

    } catch (error) {
        console.error("❌ ERROR FATAL:", error.message);
    }
}
main();
