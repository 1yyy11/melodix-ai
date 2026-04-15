
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const GENIUS_ACCESS_TOKEN = '0yMlIu83IbruTlz6GvVv6jIndVTIXSWfLf4I8ET0riafRW9IE5BU0ROfE7jL5Llc';
const app = express();
const port = process.env.PORT || 3001;

// Конфигурация
const JWT_SECRET = 'melodix-super-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// Middleware
app.use(cors());
app.use(express.json());

// Сессии
app.use(session({
    secret: 'melodix-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// Подключение к PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'melodix',
    password: 'postgres123',
    port: 5432,
});

pool.connect((err) => {
    if (err) console.error('❌ DB error:', err);
    else console.log('✅ Connected to PostgreSQL');
});

// Middleware для проверки аутентификации
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        req.userId = req.session.userId;
        return next();
    }
    
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.userId;
            return next();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }
    
    return res.status(401).json({ error: 'Authentication required' });
};

// Путь к папке с MP3
const AUDIO_DIR = path.join(__dirname, 'scripts', 'downloaded_audio');

// Раздаём аудио файлы
app.get('/audio/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(AUDIO_DIR, filename);
    
    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(filepath, {
        headers: { 'Content-Type': 'audio/mpeg' }
    });
});

// ============= ФУНКЦИЯ ПОИСКА ТЕКСТА НА GENIUS =============
async function getLyricsFromGenius(artist, title) {
    try {
        // Поиск трека на Genius
        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${title}`)}`;
        const searchRes = await axios.get(searchUrl, {
            headers: { 'Authorization': `Bearer ${GENIUS_ACCESS_TOKEN}` }
        });
        
        const hits = searchRes.data.response.hits;
        if (!hits || hits.length === 0) {
            console.log('❌ Трек не найден на Genius');
            return null;
        }
        
        const songUrl = hits[0].result.url;
        console.log(`📄 Парсинг Genius: ${songUrl}`);
        
        // Получаем страницу с текстом
        const page = await axios.get(songUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const html = page.data;
        let lyricsText = '';
        
        // Ищем текст по data-lyrics-container
        const lyricsMatch = html.match(/<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi);
        
        if (lyricsMatch) {
            for (const match of lyricsMatch) {
                let text = match.replace(/<br\s*\/?>/gi, '\n');
                text = text.replace(/<[^>]*>/g, '');
                text = text.replace(/&quot;/g, '"');
                text = text.replace(/&amp;/g, '&');
                text = text.replace(/&lt;/g, '<');
                text = text.replace(/&gt;/g, '>');
                lyricsText += text + '\n';
            }
        }
        
        // Если не нашли - другой метод
        if (!lyricsText.trim()) {
            const classMatch = html.match(/<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
            if (classMatch) {
                for (const match of classMatch) {
                    let text = match.replace(/<br\s*\/?>/gi, '\n');
                    text = text.replace(/<[^>]*>/g, '');
                    lyricsText += text + '\n';
                }
            }
        }
        
        // Очищаем текст от мусора
        if (lyricsText.trim()) {
            const lines = lyricsText.split('\n');
            const cleanedLines = [];
            
            for (let line of lines) {
                let l = line.trim();
                if (!l) continue;
                if (l.match(/^\d+\s+Contributors?/i)) continue;
                if (l.match(/^Embed$/i)) continue;
                if (l.match(/^You might also like/i)) continue;
                if (l.match(/^\[.*\]$/)) continue;
                if (l.length < 2) continue;
                
                l = l.replace(/\([Ss]nippet[^)]*\)/g, '');
                l = l.replace(/\([Ll]yrics\)/gi, '');
                l = l.trim();
                
                if (l) cleanedLines.push(l);
            }
            
            const result = cleanedLines.join('\n');
            if (result.length > 20) {
                console.log(`✅ Текст получен (${result.length} символов)`);
                return result;
            }
        }
        
        return null;
    } catch (err) {
        console.error('Ошибка парсинга Genius:', err.message);
        return null;
    }
}

// ============= АУТЕНТИФИКАЦИЯ =============

// Регистрация
app.post('/api/auth/register', async (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        
        const result = await pool.query(
            `INSERT INTO users (id, email, password_hash, first_name, last_name, created_at, updated_at) 
             VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW()) 
             RETURNING id, email, first_name, last_name`,
            [email, passwordHash, firstName || null, lastName || null]
        );
        
        const user = result.rows[0];
        req.session.userId = user.id;
        
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Вход
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    try {
        const result = await pool.query(
            `SELECT id, email, password_hash, first_name, last_name, profile_image_url 
             FROM users WHERE email = $1`,
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        req.session.userId = user.id;
        
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                profileImageUrl: user.profile_image_url
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Выход
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// Получить текущего пользователя
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, email, first_name, last_name, profile_image_url, created_at 
             FROM users WHERE id = $1`,
            [req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            profileImageUrl: user.profile_image_url,
            createdAt: user.created_at
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Обновить профиль пользователя
app.patch('/api/user', requireAuth, async (req, res) => {
    const { firstName, lastName, profileImageUrl } = req.body;
    
    try {
        const result = await pool.query(
            `UPDATE users 
             SET first_name = COALESCE($1, first_name),
                 last_name = COALESCE($2, last_name),
                 profile_image_url = COALESCE($3, profile_image_url),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING id, email, first_name, last_name, profile_image_url`,
            [firstName, lastName, profileImageUrl, req.userId]
        );
        
        const user = result.rows[0];
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            profileImageUrl: user.profile_image_url
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ============= ТЕКСТЫ ПЕСЕН (С ПОИСКОМ НА GENIUS) =============
app.get('/api/lyrics', async (req, res) => {
    const { artist, title } = req.query;
    console.log(`🔍 Поиск текста: ${artist} - ${title}`);
    
    if (!artist || !title) {
        return res.status(400).json({ error: 'Artist and title are required' });
    }
    
    try {
        // Сначала ищем в базе данных
        const dbResult = await pool.query(
            `SELECT lyrics FROM tracks 
             WHERE title ILIKE $1 AND artist ILIKE $2`,
            [`%${title}%`, `%${artist}%`]
        );
        
        if (dbResult.rows.length > 0 && dbResult.rows[0].lyrics) {
            console.log('✅ Текст найден в базе данных');
            return res.json({ lyrics: dbResult.rows[0].lyrics, source: 'database' });
        }
        
        // Если нет в БД - ищем на Genius
        console.log('🌐 Ищем на Genius...');
        const lyrics = await getLyricsFromGenius(artist, title);
        
        if (lyrics) {
            console.log('✅ Текст получен с Genius');
            return res.json({ lyrics: lyrics, source: 'genius' });
        }
        
        console.log('❌ Текст не найден');
        res.json({ lyrics: null, error: 'Lyrics not found' });
        
    } catch (error) {
        console.error('Ошибка получения текста:', error);
        res.status(500).json({ error: error.message });
    }
});

// Альтернативный эндпоинт для текстов (совместимость)
app.get('/api/lyrics-lrc', async (req, res) => {
    const { artist, title } = req.query;
    console.log(`🎤 Запрос текста (lrc): ${artist} - ${title}`);
    
    try {
        const lyrics = await getLyricsFromGenius(artist, title);
        
        if (lyrics) {
            res.json({ plainLyrics: lyrics });
        } else {
            // Fallback текст
            const fallbackText = `Текст песни "${title}"\nИсполнитель: ${artist}\n\nК сожалению, текст не найден.\nПопробуйте поискать на Genius.com`;
            res.json({ plainLyrics: fallbackText });
        }
    } catch (error) {
        console.error('Ошибка:', error);
        res.json({ plainLyrics: `Ошибка загрузки текста: ${error.message}` });
    }
});

// ============= ТРЕКИ =============
app.get('/api/tracks', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, a.name as artist_name 
            FROM tracks t
            LEFT JOIN artists a ON t.artist_id = a.id
            ORDER BY t.created_at DESC
        `);
        
        const tracks = result.rows.map(track => ({
            id: track.id,
            title: track.title,
            artist: track.artist_name || track.artist,
            artist_id: track.artist_id,
            audioUrl: track.audio_url,
            coverUrl: track.cover_url,
            duration: track.duration,
            play_count: track.play_count,
            created_at: track.created_at
        }));
        
        res.json(tracks);
    } catch (error) {
        console.error('Error fetching tracks:', error);
        res.status(500).json({ error: 'Failed to fetch tracks' });
    }
});

// ============= ИЗБРАННОЕ =============
app.get('/api/favorites', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT t.* FROM tracks t
             JOIN favorites f ON t.id = f.track_id
             WHERE f.user_id = $1`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get favorites' });
    }
});

app.post('/api/favorites', requireAuth, async (req, res) => {
    const { trackId } = req.body;
    try {
        await pool.query(
            'INSERT INTO favorites (user_id, track_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.userId, trackId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add favorite' });
    }
});

app.delete('/api/favorites/:trackId', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM favorites WHERE user_id = $1 AND track_id = $2',
            [req.userId, req.params.trackId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
});

// ============= ПЛЕЙЛИСТЫ =============
// ============= ПЛЕЙЛИСТЫ =============

// Получить все плейлисты пользователя
app.get('/api/playlists', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, 
                    (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as tracks_count
             FROM playlists p 
             WHERE p.user_id = $1 
             ORDER BY p.created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching playlists:', error);
        res.status(500).json({ error: 'Failed to get playlists' });
    }
});

// СОЗДАНИЕ ПЛЕЙЛИСТА
app.post('/api/playlists', requireAuth, async (req, res) => {
    const { name, description } = req.body;
    
    console.log('📝 Creating playlist for user:', req.userId);
    console.log('   Name:', name);
    console.log('   Description:', description);
    
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Playlist name is required' });
    }
    
    try {
        const result = await pool.query(
            `INSERT INTO playlists (id, user_id, name, description, created_at, updated_at) 
             VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW()) 
             RETURNING id, user_id, name, description, created_at`,
            [req.userId, name.trim(), description || null]
        );
        
        console.log('✅ Playlist created:', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating playlist:', error);
        res.status(500).json({ error: 'Failed to create playlist', details: error.message });
    }
});

// Получить конкретный плейлист с треками
app.get('/api/playlists/:playlistId', requireAuth, async (req, res) => {
    const { playlistId } = req.params;
    
    try {
        const playlistResult = await pool.query(
            'SELECT * FROM playlists WHERE id = $1 AND user_id = $2',
            [playlistId, req.userId]
        );
        
        if (playlistResult.rows.length === 0) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        const playlist = playlistResult.rows[0];
        
        const tracksResult = await pool.query(
            `SELECT t.*, a.name as artist_name 
             FROM tracks t
             LEFT JOIN artists a ON t.artist_id = a.id
             JOIN playlist_tracks pt ON t.id = pt.track_id
             WHERE pt.playlist_id = $1
             ORDER BY pt.position, pt.added_at`,
            [playlistId]
        );
        
        playlist.tracks = tracksResult.rows;
        res.json(playlist);
    } catch (error) {
        console.error('Error fetching playlist:', error);
        res.status(500).json({ error: 'Failed to get playlist' });
    }
});

// Добавить трек в плейлист
app.post('/api/playlists/:playlistId/tracks', requireAuth, async (req, res) => {
    const { playlistId } = req.params;
    const { trackId } = req.body;
    
    try {
        const playlistCheck = await pool.query(
            'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
            [playlistId, req.userId]
        );
        
        if (playlistCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        const positionResult = await pool.query(
            'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM playlist_tracks WHERE playlist_id = $1',
            [playlistId]
        );
        const nextPosition = positionResult.rows[0].next_pos;
        
        await pool.query(
            `INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) 
             VALUES ($1, $2, $3, NOW()) 
             ON CONFLICT (playlist_id, track_id) DO NOTHING`,
            [playlistId, trackId, nextPosition]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding to playlist:', error);
        res.status(500).json({ error: 'Failed to add track to playlist' });
    }
});

// Удалить трек из плейлиста
app.delete('/api/playlists/:playlistId/tracks/:trackId', requireAuth, async (req, res) => {
    const { playlistId, trackId } = req.params;
    
    try {
        await pool.query(
            'DELETE FROM playlist_tracks WHERE playlist_id = $1 AND track_id = $2',
            [playlistId, trackId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error removing from playlist:', error);
        res.status(500).json({ error: 'Failed to remove track from playlist' });
    }
});

// Добавить трек в плейлист
app.post('/api/playlists/:playlistId/tracks', requireAuth, async (req, res) => {
    const { playlistId } = req.params;
    const { trackId } = req.body;
    
    try {
        // Проверяем, что плейлист принадлежит пользователю
        const playlistCheck = await pool.query(
            'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
            [playlistId, req.userId]
        );
        
        if (playlistCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Playlist not found' });
        }
        
        // Получаем следующую позицию
        const positionResult = await pool.query(
            'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM playlist_tracks WHERE playlist_id = $1',
            [playlistId]
        );
        const nextPosition = positionResult.rows[0].next_pos;
        
        // Добавляем трек
        await pool.query(
            `INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) 
             VALUES ($1, $2, $3, NOW()) 
             ON CONFLICT (playlist_id, track_id) DO NOTHING`,
            [playlistId, trackId, nextPosition]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding to playlist:', error);
        res.status(500).json({ error: 'Failed to add track to playlist' });
    }
});

// Удалить плейлист
app.delete('/api/playlists/:playlistId', requireAuth, async (req, res) => {
    const { playlistId } = req.params;
    
    try {
        await pool.query('DELETE FROM playlist_tracks WHERE playlist_id = $1', [playlistId]);
        await pool.query('DELETE FROM playlists WHERE id = $1 AND user_id = $2', [playlistId, req.userId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting playlist:', error);
        res.status(500).json({ error: 'Failed to delete playlist' });
    }
});
// ============= ГЕНЕРАЦИЯ =============
app.post('/api/generate', requireAuth, async (req, res) => {
    const { genre, mood, tempo, instruments, prompt } = req.body;
    
    const generatedTrack = {
        id: Date.now().toString(),
        title: `Generated Track (${genre})`,
        genre,
        mood,
        tempo: tempo || 120,
        duration: 180,
        user_id: req.userId,
        created_at: new Date().toISOString()
    };
    
    try {
        await pool.query(
            `INSERT INTO tracks (id, title, genre, mood, tempo, duration, user_id, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [generatedTrack.id, generatedTrack.title, genre, mood, generatedTrack.tempo, 
             generatedTrack.duration, req.userId, generatedTrack.created_at]
        );
        res.json(generatedTrack);
    } catch (error) {
        console.error('Error generating track:', error);
        res.status(500).json({ error: 'Failed to generate track' });
    }
});

// ============= ИСПОЛНИТЕЛИ =============
app.get('/api/artist/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, image_url FROM artists WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Artist not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============= ЗАПУСК =============
app.listen(port, () => {
    console.log(`🎵 MelodixAI API Server running on http://localhost:${port}`);
    console.log(`   POST /api/auth/register - Register`);
    console.log(`   POST /api/auth/login - Login`);
    console.log(`   GET  /api/lyrics?artist=&title= - Get lyrics from Genius`);
    console.log(`   GET  /api/tracks - Get tracks`);
});
