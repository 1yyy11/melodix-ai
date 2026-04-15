const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const yts = require('yt-search');
const axios = require('axios');
const { Client } = require('pg');
require('dotenv').config();

const GENIUS_ACCESS_TOKEN = '0yMlIu83IbruTlz6GvVv6jIndVTIXSWfLf4I8ET0riafRW9IE5BU0ROfE7jL5Llc';

const IMPORT_CONFIG = {
    artists: [
        { name: 'Taylor Swift', songCount: 3 },
        { name: 'The Weeknd', songCount: 3 },
    ],
    downloadQuality: '128K',
    USER_ID: 'demo-user-123'
};

const AUDIO_PATH = path.join(__dirname, 'downloaded_audio');
if (!fs.existsSync(AUDIO_PATH)) fs.mkdirSync(AUDIO_PATH, { recursive: true });

const pool = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'melodix',
    password: 'postgres123',
    port: 5432,
});

// === GENIUS API ===
async function geniusRequest(url) {
    try {
        const response = await axios({
            method: 'get',
            url: url,
            headers: {
                'Authorization': `Bearer ${GENIUS_ACCESS_TOKEN}`,
                'User-Agent': 'MelodixImporter/1.0',
            },
            timeout: 15000
        });
        return response;
    } catch (error) {
        return null;
    }
}

async function searchArtist(artistName) {
    try {
        const url = `https://api.genius.com/search?q=${encodeURIComponent(artistName)}`;
        const response = await geniusRequest(url);
        
        if (!response?.data?.response?.hits?.length) return null;
        
        for (const hit of response.data.response.hits) {
            const artist = hit.result.primary_artist;
            if (artist.name.toLowerCase() === artistName.toLowerCase()) {
                return artist;
            }
        }
        
        return response.data.response.hits[0].result.primary_artist;
    } catch (error) {
        return null;
    }
}

async function getTopSongs(artistId, limit = 5) {
    try {
        const url = `https://api.genius.com/artists/${artistId}/songs?sort=popularity&per_page=${limit}`;
        const response = await geniusRequest(url);
        
        if (!response?.data?.response?.songs) return [];
        
        return response.data.response.songs.map(song => ({
            title: song.title,
            songId: song.id,
            url: song.url,
            imageUrl: song.song_art_image_thumbnail_url
        }));
    } catch (error) {
        return [];
    }
}

// === YOUTUBE ===
async function searchYouTubeVideo(query) {
    try {
        const searchResult = await yts(query);
        if (!searchResult.videos.length) return null;
        return searchResult.videos[0];
    } catch (error) {
        return null;
    }
}

async function downloadAudio(artist, title) {
    try {
        const query = `${artist} - ${title} official audio`;
        console.log(`   🔍 Поиск: ${query}`);
        
        const video = await searchYouTubeVideo(query);
        if (!video) return null;
        
        console.log(`   🎵 Найдено: ${video.title.substring(0, 60)}...`);
        
        // ПРАВИЛЬНОЕ извлечение длительности
        let durationSeconds = 180; // значение по умолчанию
        
        if (video.duration) {
            // Если duration объект с секундами
            if (typeof video.duration === 'object' && video.duration.seconds) {
                durationSeconds = parseInt(video.duration.seconds);
            }
            // Если duration число
            else if (typeof video.duration === 'number') {
                durationSeconds = video.duration;
            }
            // Если duration строка типа "10:13"
            else if (typeof video.duration === 'string') {
                const parts = video.duration.split(':').map(Number);
                if (parts.length === 2) {
                    durationSeconds = parts[0] * 60 + parts[1];
                } else if (parts.length === 3) {
                    durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                }
            }
        }
        
        console.log(`   ⏱️ Длительность: ${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, '0')}`);
        
        const fileName = `${artist.replace(/[^a-z0-9]/gi, '_')}_${title.replace(/[^a-z0-9]/gi, '_')}.mp3`;
        const filePath = path.join(AUDIO_PATH, fileName);
        const audioUrl = `/audio/${fileName}`;
        
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`   📁 Файл уже есть (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            return { audioUrl, duration: durationSeconds, filePath };
        }
        
        console.log(`   ⏬ Скачивание...`);
        
        const command = `yt-dlp -f bestaudio --extract-audio --audio-format mp3 --audio-quality 128K -o "${filePath}" "${video.url}"`;
        await exec(command);
        
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`   ✅ Сохранено: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            return { audioUrl, duration: durationSeconds, filePath };
        }
        
        return null;
    } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
        return null;
    }
}
// === СОХРАНЕНИЕ В БД (адаптировано под реальную структуру) ===
async function saveArtist(artistName, imageUrl = null) {
    try {
        const artistId = artistName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        await pool.query(
            `INSERT INTO artists (id, name, image_url) VALUES ($1, $2, $3) 
             ON CONFLICT (id) DO NOTHING`,
            [artistId, artistName, imageUrl]
        );
        
        return artistId;
    } catch (error) {
        console.log(`   ⚠️ Ошибка сохранения исполнителя: ${error.message}`);
        return null;
    }
}

async function saveTrack(song, artistName, artistId, audioInfo) {
    const trackId = `${artistId}_${song.title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50)}_${Date.now()}`;
    
    try {
        // Используем реальные колонки из вашей БД:
        // id, user_id, title, duration, audio_url, artist_id, lyrics
        await pool.query(
            `INSERT INTO tracks (
                id, user_id, title, duration, audio_url, artist_id, lyrics, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (id) DO UPDATE SET
                 audio_url = EXCLUDED.audio_url`,
            [
                trackId,
                IMPORT_CONFIG.USER_ID,
                song.title,
                audioInfo.duration,
                audioInfo.audioUrl,
                artistId,
                song.url || null  // ссылка на Genius как lyrics
            ]
        );
        
        console.log(`   💾 Сохранено в БД (artist_id: ${artistId})`);
        return true;
        
    } catch (error) {
        console.log(`   ❌ Ошибка БД: ${error.message}`);
        return false;
    }
}

// === ИМПОРТ ===
async function importByArtists() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎵 ИМПОРТ ПО ИСПОЛНИТЕЛЯМ`);
    console.log(`${'='.repeat(60)}`);
    
    let totalSuccess = 0;
    
    for (const artistConfig of IMPORT_CONFIG.artists) {
        console.log(`\n📀 Исполнитель: ${artistConfig.name}`);
        
        const artist = await searchArtist(artistConfig.name);
        if (!artist) {
            console.log(`   ❌ Исполнитель не найден в Genius`);
            continue;
        }
        
        console.log(`   ✅ Найден: ${artist.name}`);
        
        const artistId = await saveArtist(artist.name, artist.image_url);
        const songs = await getTopSongs(artist.id, artistConfig.songCount);
        
        console.log(`   📀 Найдено песен: ${songs.length}`);
        
        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            console.log(`\n   🎵 [${i+1}/${songs.length}] ${song.title}`);
            
            const audioInfo = await downloadAudio(artist.name, song.title);
            
            if (audioInfo && artistId) {
                const saved = await saveTrack(song, artist.name, artistId, audioInfo);
                if (saved) totalSuccess++;
            }
            
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    return totalSuccess;
}

async function checkYtDlp() {
    try {
        await exec('yt-dlp --version');
        console.log('✅ yt-dlp найден');
        return true;
    } catch {
        console.log('❌ yt-dlp не найден');
        return false;
    }
}

async function checkFFmpeg() {
    return new Promise((resolve) => {
        const ff = spawn('ffmpeg', ['-version']);
        ff.on('close', (code) => {
            console.log(code === 0 ? '✅ FFmpeg найден' : '❌ FFmpeg не найден');
            resolve(code === 0);
        });
    });
}

async function initDatabase() {
    try {
        await pool.connect();
        console.log('✅ PostgreSQL подключен');
        
        // Проверяем структуру
        const result = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'tracks' 
            ORDER BY ordinal_position
        `);
        console.log('📋 Колонки в tracks:', result.rows.map(r => r.column_name).join(', '));
        
        return true;
    } catch (error) {
        console.log(`⚠️ PostgreSQL не доступен: ${error.message}`);
        return false;
    }
}

async function testGeniusToken() {
    console.log('\n🔑 Тестируем Genius API...');
    const testArtist = await searchArtist('Taylor Swift');
    if (testArtist) {
        console.log('✅ Genius API работает!\n');
        return true;
    } else {
        console.log('❌ Genius API не работает\n');
        return false;
    }
}

async function main() {
    console.log('\n🎵 MelodixAI Importer v9.0 (адаптирован под вашу БД)\n');
    
    if (!await checkFFmpeg()) {
        console.log('Установите FFmpeg: sudo apt install ffmpeg\n');
        return;
    }
    
    if (!await checkYtDlp()) {
        console.log('Установите yt-dlp: pip install yt-dlp\n');
        return;
    }
    
    await initDatabase();
    await testGeniusToken();
    
    const totalSuccess = await importByArtists();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✨ ИМПОРТ ЗАВЕРШЁН`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   ✅ Скачано треков: ${totalSuccess}`);
    console.log(`   📁 Папка: ${AUDIO_PATH}`);
    
    try {
        const result = await pool.query('SELECT COUNT(*) FROM tracks');
        console.log(`   💾 Всего треков в БД: ${result.rows[0].count}`);
        await pool.end();
    } catch (e) {}
    
    console.log(`${'='.repeat(60)}\n`);
}

main().catch(console.error);