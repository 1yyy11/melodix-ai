
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const yts = require('yt-search');
const axios = require('axios');
const { Client } = require('pg');
require('dotenv').config();

// ============================================================
// КОНФИГУРАЦИЯ
// ============================================================

const GENIUS_ACCESS_TOKEN = '0yMlIu83IbruTlz6GvVv6jIndVTIXSWfLf4I8ET0riafRW9IE5BU0ROfE7jL5Llc';
const LASTFM_API_KEY = '4d832a008d51c002d4bffa0dda20abc4';

const IMPORT_CONFIG = {
    artists: [
     { name: 'Земфира', songCount: 4 },
        { name: 'Би-2', songCount: 4 },
        { name: 'Король и Шут', songCount: 4 },
        // Добавляем русских
        { name: 'Баста', songCount: 3 },
    
    ],
    downloadQuality: '128K',
    USER_ID: 'demo-user-123'
};

// Пути
const AUDIO_PATH = path.join(__dirname, 'downloaded_audio');
const COVERS_PATH = path.join(__dirname, 'uploads/covers');

// Создаём папки
if (!fs.existsSync(AUDIO_PATH)) fs.mkdirSync(AUDIO_PATH, { recursive: true });
if (!fs.existsSync(COVERS_PATH)) fs.mkdirSync(COVERS_PATH, { recursive: true });

// Подключение к БД
const pool = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'melodix',
    password: 'postgres123',
    port: 5432,
});

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanId(text) {
    // Транслитерация русских букв в латиницу
    const translit = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
        'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    
    let result = '';
    for (let char of text.toLowerCase()) {
        if (translit[char]) {
            result += translit[char];
        } else if (/[a-z0-9]/i.test(char)) {
            result += char;
        } else {
            result += '_';
        }
    }
    
    return result.replace(/[^a-z0-9]/g, '_').substring(0, 100);
}

// ============================================================
// ПОЛУЧЕНИЕ ПОЛНОЙ ИНФОРМАЦИИ ОБ ИСПОЛНИТЕЛЕ ИЗ LastFM
// ============================================================

async function getFullArtistInfoFromLastFM(artistName) {
    try {
        const url = `http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json`;
        const response = await axios.get(url, { timeout: 15000 });
        
        if (!response.data?.artist) return null;
        
        const artist = response.data.artist;
        
        // Извлекаем жанры из тегов
        let genres = [];
        if (artist.tags?.tag) {
            genres = Array.isArray(artist.tags.tag) 
                ? artist.tags.tag.map(t => t.name)
                : [artist.tags.tag.name];
        }
        
        // Извлекаем изображения разных размеров
        let imageUrl = null;
        if (artist.image) {
            const images = artist.image;
            // Приоритет: extralarge > large > medium
            const largeImage = images.find(i => i.size === 'extralarge')?.['#text'] ||
                              images.find(i => i.size === 'mega')?.['#text'] ||
                              images.find(i => i.size === 'large')?.['#text'];
            imageUrl = largeImage;
        }
        
        // Очищаем биографию от HTML тегов
        let bio = artist.bio?.summary || null;
        if (bio) {
            bio = bio.replace(/<a[^>]*>.*?<\/a>/g, '')
                     .replace(/<[^>]*>/g, '')
                     .trim();
            // Ограничиваем длину
            if (bio.length > 1000) bio = bio.substring(0, 997) + '...';
        }
        
        return {
            name: artist.name,
            imageUrl: imageUrl,
            bio: bio,
            listeners: parseInt(artist.stats?.listeners) || 0,
            playcount: parseInt(artist.stats?.playcount) || 0,
            genres: genres.slice(0, 8) // первые 8 жанров
        };
    } catch (error) {
        console.log(`   ⚠️ LastFM ошибка для ${artistName}: ${error.message}`);
        return null;
    }
}

// ============================================================
// ОБЛОЖКИ ИЗ GENIUS API
// ============================================================

async function downloadImage(url, filename) {
    if (!url) return null;
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 15000
        });
        
        const filePath = path.join(COVERS_PATH, filename);
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(`/uploads/covers/${filename}`));
            writer.on('error', reject);
        });
    } catch (error) {
        return null;
    }
}

async function searchGenius(query) {
    try {
        const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${GENIUS_ACCESS_TOKEN}` }
        });
        return response.data?.response?.hits?.[0]?.result || null;
    } catch (error) {
        return null;
    }
}

async function updateArtistCover(artistId, artistName, existingImageUrl = null) {
    // Сначала пробуем использовать изображение из LastFM
    if (existingImageUrl) {
        const filename = `${artistId}_artist_lastfm.jpg`;
        const coverUrl = await downloadImage(existingImageUrl, filename);
        if (coverUrl) {
            await pool.query('UPDATE artists SET image_url = $1 WHERE id = $2', [coverUrl, artistId]);
            console.log(`      ✅ Обложка из LastFM добавлена!`);
            return true;
        }
    }
    
    // Если нет, пробуем Genius
    const geniusResult = await searchGenius(artistId.replace(/_/g, ' '));
    const imageUrl = geniusResult?.primary_artist?.image_url;
    
    if (imageUrl) {
        const filename = `${artistId}_artist_genius.jpg`;
        const coverUrl = await downloadImage(imageUrl, filename);
        if (coverUrl) {
            await pool.query('UPDATE artists SET image_url = $1 WHERE id = $2', [coverUrl, artistId]);
            console.log(`      ✅ Обложка из Genius добавлена!`);
            return true;
        }
    }
    
    // Заглушка
    const placeholderUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(artistId.replace(/_/g, '+'))}&background=6c63ff&color=fff&size=300`;
    const filename = `${artistId}_artist_placeholder.png`;
    const coverUrl = await downloadImage(placeholderUrl, filename);
    if (coverUrl) {
        await pool.query('UPDATE artists SET image_url = $1 WHERE id = $2', [coverUrl, artistId]);
        console.log(`      ⚠️ Использована заглушка для исполнителя`);
    }
    return false;
}

async function updateTrackCover(trackId, artistName, trackTitle) {
    const geniusResult = await searchGenius(`${artistName} ${trackTitle}`);
    const imageUrl = geniusResult?.song_art_image_url || geniusResult?.header_image_url;
    
    if (imageUrl) {
        const filename = `${trackId}_cover.jpg`;
        const coverUrl = await downloadImage(imageUrl, filename);
        if (coverUrl) {
            await pool.query('UPDATE tracks SET cover_url = $1 WHERE id = $2', [coverUrl, trackId]);
            console.log(`      ✅ Обложка трека добавлена!`);
            return true;
        }
    }
    return false;
}

// ============================================================
// GENIUS API (поиск исполнителей и песен)
// ============================================================

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
        console.log(`   ⚠️ Genius ошибка: ${error.message}`);
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

async function getArtistSongs(artistId, limit = 10) {
    try {
        const url = `https://api.genius.com/artists/${artistId}/songs?sort=popularity&per_page=${limit}`;
        const response = await geniusRequest(url);
        
        if (!response?.data?.response?.songs) return [];
        
        return response.data.response.songs.map(song => ({
            id: song.id,
            title: song.title,
            url: song.url,
            imageUrl: song.song_art_image_thumbnail_url,
            albumName: song.album?.name || null,
            releaseDate: song.release_date_components?.year || null
        }));
    } catch (error) {
        return [];
    }
}

// ============================================================
// YouTube (поиск и скачивание аудио)
// ============================================================

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
        
        let durationSeconds = 180;
        if (video.duration) {
            if (typeof video.duration === 'object' && video.duration.seconds) {
                durationSeconds = parseInt(video.duration.seconds);
            } else if (typeof video.duration === 'number') {
                durationSeconds = video.duration;
            } else if (typeof video.duration === 'string') {
                const parts = video.duration.split(':').map(Number);
                if (parts.length === 2) {
                    durationSeconds = parts[0] * 60 + parts[1];
                } else if (parts.length === 3) {
                    durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                }
            }
        }
        
        const fileName = `${cleanId(artist)}_${cleanId(title)}.mp3`;
        const filePath = path.join(AUDIO_PATH, fileName);
        const audioUrl = `/audio/${fileName}`;
        
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`   📁 Файл уже есть (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            return { audioUrl, duration: durationSeconds, filePath };
        }
        
        console.log(`   ⏬ Скачивание...`);
        const command = `yt-dlp -f bestaudio --extract-audio --audio-format mp3 --audio-quality ${IMPORT_CONFIG.downloadQuality} -o "${filePath}" "${video.url}"`;
        await exec(command);
        
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`   ✅ Сохранено: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            return { audioUrl, duration: durationSeconds, filePath };
        }
        
        return null;
    } catch (error) {
        console.log(`   ❌ Ошибка скачивания: ${error.message}`);
        return null;
    }
}

// ============================================================
// Определение настроения
// ============================================================

function detectMood(title, bpm = null) {
    const titleLower = title.toLowerCase();
    
    const moodKeywords = {
        happy: ['happy', 'joy', 'smile', 'sun', 'dance', 'party', 'celebration', 'wonderful'],
        sad: ['sad', 'cry', 'tears', 'lonely', 'alone', 'broken', 'heartbreak', 'pain', 'hurt'],
        energetic: ['energy', 'run', 'fight', 'power', 'strong', 'rage', 'fire', 'storm'],
        calm: ['calm', 'peace', 'quiet', 'silence', 'rest', 'sleep', 'dream', 'lullaby'],
        romantic: ['love', 'romance', 'kiss', 'heart', 'darling', 'sweet', 'together'],
        dark: ['dark', 'night', 'shadow', 'evil', 'hell', 'devil', 'monster']
    };
    
    for (const [mood, keywords] of Object.entries(moodKeywords)) {
        for (const keyword of keywords) {
            if (titleLower.includes(keyword)) {
                return mood;
            }
        }
    }
    
    if (bpm) {
        if (bpm < 80) return 'calm';
        if (bpm >= 80 && bpm < 100) return 'romantic';
        if (bpm >= 100 && bpm < 120) return 'happy';
        if (bpm >= 120) return 'energetic';
    }
    
    return 'unknown';
}

// ============================================================
// Получение текста песни с Genius
// ============================================================

async function getLyricsFromGenius(songUrl) {
    if (!songUrl) return null;
    
    try {
        const response = await axios.get(songUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        
        const html = response.data;
        let lyricsText = '';
        
        const lyricsMatch = html.match(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi);
        
        if (lyricsMatch) {
            for (const match of lyricsMatch) {
                let text = match.replace(/<br\s*\/?>/gi, '\n');
                text = text.replace(/<[^>]*>/g, '');
                text = text.replace(/&quot;/g, '"');
                text = text.replace(/&amp;/g, '&');
                lyricsText += text + '\n';
            }
        }
        
        if (lyricsText.trim()) {
            const lines = lyricsText.split('\n');
            const cleaned = lines.filter(line => {
                const l = line.trim();
                if (!l) return false;
                if (l.match(/^\d+\s+Contributors?/i)) return false;
                if (l.match(/^Embed$/i)) return false;
                if (l.match(/^You might also like/i)) return false;
                if (l.length < 2) return false;
                return true;
            });
            return cleaned.join('\n');
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// ============================================================
// Сохранение в базу данных
// ============================================================

async function saveArtist(artistName, lastFMInfo) {
    const artistId = cleanId(artistName);
    
    try {
        // Проверяем, существует ли уже исполнитель
        const existing = await pool.query('SELECT id FROM artists WHERE id = $1', [artistId]);
        
        if (existing.rows.length > 0) {
            console.log(`   ⚠️ Исполнитель уже существует, обновляем информацию...`);
            await pool.query(`
                UPDATE artists SET
                    name = $2,
                    bio = COALESCE($3, bio),
                    listeners = $4,
                    playcount = $5,
                    genres = $6,
                    created_at = NOW()
                WHERE id = $1
            `, [
                artistId,
                artistName,
                lastFMInfo?.bio,
                lastFMInfo?.listeners || 0,
                lastFMInfo?.playcount || 0,
                lastFMInfo?.genres || []
            ]);
        } else {
            await pool.query(`
                INSERT INTO artists (id, name, bio, listeners, playcount, genres, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `, [
                artistId,
                artistName,
                lastFMInfo?.bio,
                lastFMInfo?.listeners || 0,
                lastFMInfo?.playcount || 0,
                lastFMInfo?.genres || []
            ]);
        }
        
        console.log(`   ✅ Исполнитель сохранён: ${artistName}`);
        console.log(`      📝 Биография: ${lastFMInfo?.bio ? 'да' : 'нет'}`);
        console.log(`      🎵 Слушателей: ${(lastFMInfo?.listeners || 0).toLocaleString()}`);
        console.log(`      ▶️ Прослушиваний: ${(lastFMInfo?.playcount || 0).toLocaleString()}`);
        console.log(`      🏷️ Жанры: ${lastFMInfo?.genres?.join(', ') || 'не определены'}`);
        
        // Добавляем обложку исполнителя
        await updateArtistCover(artistId, artistName, lastFMInfo?.imageUrl);
        
        return artistId;
    } catch (error) {
        console.log(`   ❌ Ошибка сохранения исполнителя: ${error.message}`);
        return null;
    }
}

async function saveAlbum(albumName, artistId, releaseDate, coverUrl) {
    if (!albumName) return null;
    
    const albumId = cleanId(`${artistId}_${albumName}`);
    
    try {
        await pool.query(`
            INSERT INTO albums (id, name, artist_id, release_date, cover_url, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (id) DO NOTHING
        `, [albumId, albumName, artistId, releaseDate, coverUrl]);
        
        return albumId;
    } catch (error) {
        return null;
    }
}

async function saveTrack(trackData, artistId, albumId, audioInfo, lyrics, artistName) {
    const trackId = `${artistId}_${cleanId(trackData.title)}_${Date.now()}`;
    const mood = detectMood(trackData.title, trackData.bpm);
    const genre = trackData.genre || 'unknown';
    
    try {
        await pool.query(`
            INSERT INTO tracks (
                id, user_id, title, artist_id, album_id, genre, mood, 
                tempo, duration, audio_url, cover_url, lyrics, 
                track_number, release_date, play_count, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
            ON CONFLICT (id) DO UPDATE SET
                audio_url = EXCLUDED.audio_url,
                lyrics = COALESCE(EXCLUDED.lyrics, tracks.lyrics)
        `, [
            trackId,
            IMPORT_CONFIG.USER_ID,
            trackData.title,
            artistId,
            albumId,
            genre,
            mood,
            trackData.bpm || null,
            audioInfo.duration,
            audioInfo.audioUrl,
            trackData.imageUrl || null,
            lyrics,
            trackData.trackNumber || null,
            trackData.releaseDate || null,
            0
        ]);
        
        console.log(`   ✅ Трек сохранён: ${trackData.title}`);
        console.log(`      🎵 Жанр: ${genre}, Настроение: ${mood}`);
        console.log(`      ⏱️ Длительность: ${Math.floor(audioInfo.duration / 60)}:${(audioInfo.duration % 60).toString().padStart(2, '0')}`);
        
        // Добавляем обложку трека
        await updateTrackCover(trackId, artistName, trackData.title);
        
        return true;
    } catch (error) {
        console.log(`   ❌ Ошибка сохранения трека: ${error.message}`);
        return false;
    }
}

async function updateAlbumTrackCount(albumId) {
    if (!albumId) return;
    try {
        await pool.query(`
            UPDATE albums 
            SET track_count = (SELECT COUNT(*) FROM tracks WHERE album_id = $1)
            WHERE id = $1
        `, [albumId]);
    } catch (error) {}
}

// ============================================================
// ОСНОВНОЙ ПРОЦЕСС ИМПОРТА
// ============================================================

async function importArtist(artistConfig) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎤 ИМПОРТ ИСПОЛНИТЕЛЯ: ${artistConfig.name}`);
    console.log(`${'='.repeat(70)}`);
    
    // ШАГ 1: Получение информации из LastFM
    console.log(`\n📡 ШАГ 1: Получение информации из LastFM...`);
    const lastFMInfo = await getFullArtistInfoFromLastFM(artistConfig.name);
    if (lastFMInfo) {
        console.log(`   ✅ Название: ${lastFMInfo.name}`);
        console.log(`   ✅ Жанры: ${lastFMInfo.genres.slice(0, 5).join(', ') || 'не определены'}`);
        console.log(`   ✅ Слушателей: ${lastFMInfo.listeners.toLocaleString()}`);
        console.log(`   ✅ Прослушиваний: ${lastFMInfo.playcount.toLocaleString()}`);
        console.log(`   ✅ Биография: ${lastFMInfo.bio ? `${lastFMInfo.bio.substring(0, 100)}...` : 'нет'}`);
    } else {
        console.log(`   ⚠️ Не удалось получить информацию из LastFM`);
    }
    
    // ШАГ 2: Поиск в Genius для песен
    console.log(`\n📡 ШАГ 2: Поиск исполнителя в Genius...`);
    const geniusArtist = await searchArtist(artistConfig.name);
    if (!geniusArtist) {
        console.log(`❌ Исполнитель не найден в Genius`);
        return 0;
    }
    console.log(`   ✅ Найден: ${geniusArtist.name}`);
    
    // ШАГ 3: Сохранение исполнителя в БД
    console.log(`\n💾 ШАГ 3: Сохранение исполнителя в БД...`);
    const artistId = await saveArtist(artistConfig.name, lastFMInfo);
    if (!artistId) return 0;
    
    // ШАГ 4: Получение списка песен
    console.log(`\n📡 ШАГ 4: Получение списка песен из Genius...`);
    const songs = await getArtistSongs(geniusArtist.id, artistConfig.songCount);
    console.log(`   ✅ Найдено песен: ${songs.length}`);
    
    let successCount = 0;
    
    for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        console.log(`\n--- [${i+1}/${songs.length}] 🎵 ${song.title} ---`);
        
        // ШАГ 5: Скачивание аудио
        console.log(`\n📡 Скачивание аудио...`);
        const audioInfo = await downloadAudio(artistConfig.name, song.title);
        if (!audioInfo) {
            console.log(`   ❌ Не удалось скачать аудио`);
            continue;
        }
        
        // ШАГ 6: Получение текста песни
        console.log(`\n📡 Получение текста песни...`);
        const lyrics = await getLyricsFromGenius(song.url);
        if (lyrics) {
            console.log(`   ✅ Текст получен (${lyrics.length} символов)`);
        } else {
            console.log(`   ⚠️ Текст не найден`);
        }
        
        // ШАГ 7: Сохранение альбома
        console.log(`\n📡 Сохранение альбома...`);
        let albumId = null;
        if (song.albumName) {
            albumId = await saveAlbum(song.albumName, artistId, song.releaseDate, song.imageUrl);
            if (albumId) console.log(`   ✅ Альбом: ${song.albumName}`);
        } else {
            console.log(`   ⚠️ Альбом не указан`);
        }
        
        // ШАГ 8: Определение жанра
        let genre = null;
        if (lastFMInfo?.genres?.length) {
            genre = lastFMInfo.genres[0];
            console.log(`\n📡 Жанр: ${genre}`);
        }
        
        // ШАГ 9: Сохранение трека
        console.log(`\n💾 Сохранение трека в БД...`);
        const trackData = {
            title: song.title,
            imageUrl: song.imageUrl,
            bpm: null,
            genre: genre,
            trackNumber: i + 1,
            releaseDate: song.releaseDate ? `${song.releaseDate}-01-01` : null
        };
        
        const saved = await saveTrack(trackData, artistId, albumId, audioInfo, lyrics, artistConfig.name);
        if (saved) successCount++;
        
        if (albumId) await updateAlbumTrackCount(albumId);
        
        // Задержка между треками
        await delay(3000);
    }
    
    return successCount;
}

// ============================================================
// ПРОВЕРКА ЗАВИСИМОСТЕЙ И ЗАПУСК
// ============================================================

async function checkDependencies() {
    console.log('\n🔧 Проверка зависимостей...');
    
    try {
        await exec('yt-dlp --version');
        console.log('   ✅ yt-dlp найден');
    } catch {
        console.log('   ❌ yt-dlp не найден. Установите: pip install yt-dlp');
        return false;
    }
    
    try {
        await exec('ffmpeg -version');
        console.log('   ✅ FFmpeg найден');
    } catch {
        console.log('   ❌ FFmpeg не найден. Установите: sudo apt install ffmpeg');
        return false;
    }
    
    return true;
}

async function main() {
    console.log('\n🎵 MelodixAI Complete Importer');
    console.log('📋 Заполняет таблицу artists полностью: id, name, image_url, bio, listeners, playcount, genres');
    console.log('='.repeat(70));
    
    if (!await checkDependencies()) {
        console.log('\n❌ Установите недостающие зависимости и запустите снова');
        return;
    }
    
    try {
        await pool.connect();
        console.log('✅ PostgreSQL подключен');
    } catch (error) {
        console.log(`❌ Ошибка подключения к БД: ${error.message}`);
        return;
    }
    
    let totalSuccess = 0;
    
    for (const artist of IMPORT_CONFIG.artists) {
        const count = await importArtist(artist);
        totalSuccess += count;
        await delay(5000);
    }
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✨ ИМПОРТ ЗАВЕРШЁН`);
    console.log(`${'='.repeat(70)}`);
    console.log(`   ✅ Успешно импортировано треков: ${totalSuccess}`);
    console.log(`   📁 Аудио файлы: ${AUDIO_PATH}`);
    console.log(`   🖼️ Обложки: ${COVERS_PATH}`);
    
    try {
        const result = await pool.query('SELECT COUNT(*) FROM tracks');
        console.log(`   💾 Всего треков в БД: ${result.rows[0].count}`);
        
        const artistsResult = await pool.query('SELECT COUNT(*) FROM artists');
        console.log(`   🎤 Всего исполнителей в БД: ${artistsResult.rows[0].count}`);
        
        // Показываем пример данных
        const sample = await pool.query(`
            SELECT id, name, listeners, playcount, genres[1:3] as top_genres
            FROM artists 
            LIMIT 3
        `);
        if (sample.rows.length > 0) {
            console.log(`\n📊 Пример данных в таблице artists:`);
            sample.rows.forEach(a => {
                console.log(`   🎤 ${a.name}: слушателей ${a.listeners.toLocaleString()}, жанры: ${a.top_genres?.join(', ') || 'нет'}`);
            });
        }
    } catch (e) {}
    
    await pool.end();
    console.log(`${'='.repeat(70)}\n`);
}

main().catch(console.error);
