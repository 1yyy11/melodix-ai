const axios = require('axios');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// === НАСТРОЙКИ ===
const GENIUS_ACCESS_TOKEN = '0yMlIu83IbruTlz6GvVv6jIndVTIXSWfLf4I8ET0riafRW9IE5BU0ROfE7jL5Llc';
const VK_ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN; // Токен VK

const ARTISTS_TO_IMPORT = [
    'Taylor Swift',
    'The Weeknd',
    'Drake',
    'Billie Eilish',
    'Ed Sheeran'
];

const pool = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'melodix',
    password: 'postgres123',
    port: 5432,
});

// Создаём папку для аудио
const AUDIO_STORAGE_PATH = path.join(__dirname, '../public/audio');
if (!fs.existsSync(AUDIO_STORAGE_PATH)) {
    fs.mkdirSync(AUDIO_STORAGE_PATH, { recursive: true });
    console.log('📁 Создана папка для аудио:', AUDIO_STORAGE_PATH);
}

// === ПОИСК И СКАЧИВАНИЕ АУДИО ИЗ VK ===
async function downloadAudioFromVK(artistName, trackTitle) {
    if (!VK_ACCESS_TOKEN) {
        console.log(`   ⚠️ Нет VK токена, пропускаем аудио`);
        return null;
    }
    
    try {
        const query = `${artistName} ${trackTitle}`;
        console.log(`   🔍 Ищем в VK: ${query}`);
        
        // 1. Поиск трека
        const searchUrl = `https://api.vk.com/method/audio.search?q=${encodeURIComponent(query)}&access_token=${VK_ACCESS_TOKEN}&v=5.131&count=5`;
        const response = await axios.get(searchUrl);
        
        const items = response.data?.response?.items;
        if (!items || items.length === 0) {
            console.log(`   ❌ Трек не найден в VK`);
            return null;
        }
        
        // 2. Ищем лучшее совпадение по исполнителю
        let bestMatch = null;
        for (const track of items) {
            const trackArtist = track.artist.toLowerCase();
            const searchArtist = artistName.toLowerCase();
            if (trackArtist.includes(searchArtist) || searchArtist.includes(trackArtist)) {
                bestMatch = track;
                break;
            }
        }
        if (!bestMatch) bestMatch = items[0];
        
        const mp3Url = bestMatch.url;
        if (!mp3Url) {
            console.log(`   ❌ Нет ссылки на MP3`);
            return null;
        }
        
        console.log(`   🎵 Найдено: ${bestMatch.artist} - ${bestMatch.title}`);
        
        // 3. Генерируем имя файла
        const safeArtist = bestMatch.artist.replace(/[^a-zа-я0-9]/gi, '_');
        const safeTitle = bestMatch.title.replace(/[^a-zа-я0-9]/gi, '_');
        const fileName = `${safeArtist}_${safeTitle}.mp3`;
        const filePath = path.join(AUDIO_STORAGE_PATH, fileName);
        const publicUrl = `/audio/${fileName}`;
        
        // 4. Если файл уже есть — возвращаем
        if (fs.existsSync(filePath)) {
            console.log(`   📁 Файл уже существует`);
            return {
                audio_url: publicUrl,
                duration: bestMatch.duration,
                cover_url: bestMatch.photo || null
            };
        }
        
        // 5. Скачиваем MP3
        const writer = fs.createWriteStream(filePath);
        const mp3Response = await axios({
            method: 'get',
            url: mp3Url,
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 30000
        });
        
        mp3Response.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        console.log(`   ✅ Скачан: ${fileName}`);
        return {
            audio_url: publicUrl,
            duration: bestMatch.duration,
            cover_url: bestMatch.photo || null
        };
        
    } catch (error) {
        console.error(`   ❌ Ошибка VK: ${error.message}`);
        return null;
    }
}

// === ПОЛУЧАЕМ ССЫЛКУ НА ТЕКСТ ИЗ GENIUS ===
async function getLyricsUrl(songId) {
    try {
        const url = `https://api.genius.com/songs/${songId}`;
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${GENIUS_ACCESS_TOKEN}` }
        });
        return response.data.response.song.url;
    } catch (error) {
        return null;
    }
}

// === ПОИСК ИСПОЛНИТЕЛЯ ===
async function searchArtist(artistName) {
    try {
        const url = `https://api.genius.com/search?q=${encodeURIComponent(artistName)}`;
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${GENIUS_ACCESS_TOKEN}` }
        });
        
        const hits = response.data.response.hits;
        if (hits && hits.length > 0) {
            return hits[0].result.primary_artist;
        }
        return null;
    } catch (error) {
        console.error(`Ошибка поиска ${artistName}:`, error.message);
        return null;
    }
}

// === ПОЛУЧАЕМ ТРЕКИ ИСПОЛНИТЕЛЯ ===
async function getArtistSongs(artistId) {
    try {
        const url = `https://api.genius.com/artists/${artistId}/songs?sort=popularity&per_page=10`;
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${GENIUS_ACCESS_TOKEN}` }
        });
        return response.data.response.songs;
    } catch (error) {
        console.error(`Ошибка получения треков:`, error.message);
        return [];
    }
}

// === ОСНОВНАЯ ФУНКЦИЯ ИМПОРТА ===
async function importArtist(artistName) {
    console.log(`\n📀 Импорт: ${artistName}`);
    
    const artist = await searchArtist(artistName);
    if (!artist) {
        console.log(`❌ Исполнитель не найден в Genius`);
        return;
    }
    
    console.log(`✅ Найден: ${artist.name}`);
    
    // Сохраняем исполнителя
    await pool.query(
        `INSERT INTO artists (id, name, image_url) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [String(artist.id), artist.name, artist.image_url]
    );
    
    const songs = await getArtistSongs(artist.id);
    console.log(`📀 Найдено треков: ${songs.length}`);
    
    let successCount = 0;
    let audioCount = 0;
    
    for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        console.log(`\n    🎵 [${i+1}/${songs.length}] ${song.title}`);
        
        const lyricsUrl = await getLyricsUrl(song.id);
        const audioData = await downloadAudioFromVK(artist.name, song.title);
        
        const trackId = `${artist.id}_${song.id}`;
        
        try {
            await pool.query(
                `INSERT INTO tracks (id, title, artist_id, lyrics, audio_url, duration, cover_url, user_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO UPDATE SET
                 audio_url = EXCLUDED.audio_url,
                 lyrics = EXCLUDED.lyrics`,
                [
                    trackId,
                    song.title,
                    String(artist.id),
                    lyricsUrl,
                    audioData?.audio_url || null,
                    audioData?.duration || 180,
                    audioData?.cover_url || song.song_art_image_thumbnail_url,
                    'demo-user-123'
                ]
            );
            
            const hasAudio = audioData?.audio_url ? '🎵' : '❌';
            if (hasAudio === '🎵') audioCount++;
            console.log(`    ✅ Сохранён ${hasAudio}`);
            successCount++;
        } catch (dbError) {
            console.error(`    ❌ Ошибка БД: ${dbError.message}`);
        }
        
        // Задержка между треками
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log(`\n📊 Результат: ✅ ${successCount} треков, из них с аудио: ${audioCount}`);
}

// === СТАТИСТИКА ===
async function showStatistics() {
    const stats = await pool.query(`
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN audio_url IS NOT NULL AND audio_url != '' THEN 1 END) as with_audio,
            COUNT(CASE WHEN lyrics IS NOT NULL AND lyrics != '' THEN 1 END) as with_lyrics
        FROM tracks
    `);
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 СТАТИСТИКА ИМПОРТА`);
    console.log(`${'='.repeat(50)}`);
    console.log(`   Всего треков:   ${stats.rows[0].total}`);
    console.log(`   С аудио (VK):   ${stats.rows[0].with_audio}`);
    console.log(`   С текстом:      ${stats.rows[0].with_lyrics}`);
    console.log(`${'='.repeat(50)}\n`);
}

// === ЗАПУСК ===
async function main() {
    console.log('\n🎵 Импорт Genius + VK Audio\n');
    console.log(`VK токен: ${VK_ACCESS_TOKEN ? '✅' : '❌ (не задан)'}`);
    
    if (!VK_ACCESS_TOKEN) {
        console.log('\n⚠️ ВНИМАНИЕ: VK_ACCESS_TOKEN не задан в .env файле!');
        console.log('Музыка не будет загружаться. Только тексты.\n');
    }
    
    await pool.connect();
    console.log('✅ PostgreSQL\n');
    
    for (const artist of ARTISTS_TO_IMPORT) {
        await importArtist(artist);
        await new Promise(r => setTimeout(r, 2000));
    }
    
    await showStatistics();
    await pool.end();
}

main().catch(console.error);