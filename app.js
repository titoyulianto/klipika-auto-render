const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const ffmpeg = require('fluent-ffmpeg');

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN;

let payload = {};
try {
    payload = JSON.parse(process.env.PAYLOAD_DARI_HP || '{}');
} catch (e) {
    console.log("Payload kosong atau format salah");
}

const judul = payload.judulVideo || "Video Multi-Scene Klipika";
const deskripsi = payload.deskripsiVideo || "Video otomatis dari Cloud Klipika.";
const scenes = payload.scenes || [
    { url: "https://images.pexels.com/photos/3944688/pexels-photo-3944688.jpeg?auto=compress&cs=tinysrgb&w=720&h=1280&dpr=1", type: "image", duration: 5 }
];
// Tangkap URL Audio VO jika dikirim dari UI
const audioUrl = payload.audioUrl || null;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

async function downloadFile(url, filepath) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Gagal download aset dari ${url}`);
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(arrayBuffer));
}

async function main() {
    console.log(`🎬 Memulai render multi-adegan (${scenes.length} adegan)...`);
    const rawOutputVideo = './raw_output.mp4';
    const outputFilePath = './output_video.mp4';
    let clipPaths = [];
    let tempAudioPath = './temp_audio.mp3';
    let hasAudio = false;

    try {
        // 1. Download Audio VO 
        if (audioUrl && audioUrl.startsWith('http')) {
            try {
                console.log(`📥 Mendownload Audio VO dari: ${audioUrl}`);
                await downloadFile(audioUrl, tempAudioPath);
                hasAudio = true;
            } catch (err) {
                console.log("⚠️ Gagal download audio VO, lanjut tanpa audio.");
            }
        }

        // 2. Render adegan + Tambah Efek Judul Teks (Breaking News)
        let safeJudul = judul.replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase(); // Bersihkan teks dari simbol aneh
        
        for (let i = 0; i < scenes.length; i++) {
            let scene = scenes[i];
            let tempFile = `./temp_asset_${i}.${scene.type === 'video' ? 'mp4' : 'jpg'}`;
            let clipOutput = `./clip_${i}.mp4`;
            
            await downloadFile(scene.url, tempFile);

            console.log(`🎞️ Merender klip ${i+1}...`);
            await new Promise((resolve, reject) => {
                let cmd = ffmpeg();
                if (scene.type === 'video') { cmd.input(tempFile); } 
                else { cmd.input(tempFile).inputOptions(['-loop 1']); }

                cmd.outputOptions([
                    '-c:v libx264',
                    '-t ' + scene.duration,
                    '-pix_fmt yuv420p',
                    // Baris sakti ini yang bikin efek Zoom + Tulisan merah ala Breaking News!
                    `-vf scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,drawtext=text='${safeJudul}':fontcolor=white:fontsize=40:box=1:boxcolor=red@0.8:boxborderw=10:x=(w-text_w)/2:y=150`,
                    '-r 30'
                ])
                .save(clipOutput)
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
            });
            clipPaths.push(clipOutput);
        }

        // 3. Gabungkan semua klip gambar/video
        let listTxtContent = clipPaths.map(p => `file '${path.resolve(p)}'`).join('\n');
        fs.writeFileSync('./list.txt', listTxtContent);

        await new Promise((resolve, reject) => {
            ffmpeg().input('./list.txt').inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c copy']).save(rawOutputVideo)
            .on('end', () => resolve()).on('error', (err) => reject(err));
        });

        // 4. MENGGABUNGKAN VIDEO DENGAN AUDIO VO
        await new Promise((resolve, reject) => {
            let mixCmd = ffmpeg().input(rawOutputVideo);
            if (hasAudio) {
                mixCmd.input(tempAudioPath).outputOptions([
                    '-c:v copy', '-c:a aac', '-map 0:v:0', '-map 1:a:0', '-shortest'
                ]);
            } else {
                mixCmd.outputOptions(['-c:v copy']);
            }
            mixCmd.save(outputFilePath)
                  .on('end', () => resolve())
                  .on('error', (err) => reject(err));
        });

        // 5. Upload ke YouTube
        console.log("✅ Perakitan video selesai! Mengunggah ke YouTube...");
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: { title: judul, description: deskripsi, tags: ['klipika', 'shorts'], categoryId: '22' },
                status: { privacyStatus: 'private', selfDeclaredMadeForKids: false }
            },
            media: { body: fs.createReadStream(outputFilePath) }
        });
        console.log("🎉 SUCCESS, BRO! Link YouTube: https://youtu.be/" + res.data.id);

    } catch (error) {
        console.error("❌ ERROR FATAL:", error.message);
    }
}

main();
