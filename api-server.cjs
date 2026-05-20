const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const multer = require('multer');

// ============= КОНСТАНТЫ =============
const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'melodix-super-secret-key-change-in-production';
const SALT_ROUNDS = 10;
const GENIUS_ACCESS_TOKEN = '0yMlIu83IbruTlz6GvVv6jIndVTIXSWfLf4I8ET0riafRW9IE5BU0ROfE7jL5Llc';

require('dotenv').config();
const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ============= MIDDLEWARE =============
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://172.27.57.108:3000",
        "http://localhost:5173",
                "http://localhost:3001",
        "http://127.0.0.1:3000"
    ],
    credentials: true  // ✅ для cookies
}));

app.use(express.json());
app.use(cookieParser());

// ============= ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ COOKIE =============
const setAuthCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: false,
        path: '/',
        sameSite: false,  // ← отключи SameSite полностью для dev
        maxAge: 30 * 24 * 60 * 60 * 1000
    });
};

// ============= MIDDLEWARE AUTH =============
const requireAuth = (req, res, next) => {
    // 1. Пробуем взять токен из cookies
    let token = req.cookies?.token;
    
    // 2. Если нет - из заголовка Authorization
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// ============= ПОДКЛЮЧЕНИЕ К POSTGRESQL =============
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

// ============= АУДИО ФАЙЛЫ =============
const AUDIO_DIR = path.join(__dirname, 'downloaded_audio');
app.use('/audio', express.static(AUDIO_DIR));

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

// ============= АВАТАРЫ =============
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads/avatars');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${req.userId}${ext}`);
    }
});

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only images allowed'), false);
    }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============= ФУНКЦИИ ДЛЯ ПОИСКА ТЕКСТОВ =============
async function getLyricsFromGenius(artist, title) {
    try {
        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${title}`)}`;
        const searchRes = await axios.get(searchUrl, {
            headers: { 'Authorization': `Bearer ${GENIUS_ACCESS_TOKEN}` }
        });
        
        const hits = searchRes.data.response.hits;
        if (!hits || hits.length === 0) return null;
        
        const songUrl = hits[0].result.url;
        const page = await axios.get(songUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        const html = page.data;
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
            const cleanedLines = [];
            for (let line of lines) {
                let l = line.trim();
                if (!l) continue;
                if (l.match(/^\d+\s+Contributors?/i)) continue;
                if (l.match(/^Embed$/i)) continue;
                if (l.length < 2) continue;
                cleanedLines.push(l);
            }
            const result = cleanedLines.join('\n');
            if (result.length > 20) return result;
        }
        return null;
    } catch (err) {
        console.error('Genius error:', err.message);
        return null;
    }
}

async function getLyricsFromAmdm(artist, title) {
    try {
        const searchQuery = `${artist} ${title}`;
        const searchUrl = `https://amdm.ru/search/?text=${encodeURIComponent(searchQuery)}`;
        const searchRes = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        const $ = cheerio.load(searchRes.data);
        
        const firstLink = $('.song-item a').first().attr('href');
        if (!firstLink) return null;
        
        const songUrl = `https://amdm.ru${firstLink}`;
        const songRes = await axios.get(songUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $$ = cheerio.load(songRes.data);
        
        let lyrics = $$('.song-text').text().trim();
        if (!lyrics) lyrics = $$('.chord').text().trim();
        return lyrics || null;
    } catch (error) {
        return null;
    }
}

async function fetchFromLRCLIB(artist, title) {
    try {
        const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
        const response = await axios.get(url, { timeout: 5000 });
        if (response.data?.syncedLyrics) {
            return { source: 'lrclib', syncedLyrics: response.data.syncedLyrics };
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function fetchFromLyricsOvh(artist, title) {
    try {
        const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        const response = await axios.get(url, { timeout: 5000 });
        if (response.data?.lyrics && !response.data.lyrics.includes('No lyrics found')) {
            let lyrics = response.data.lyrics;
            lyrics = lyrics.replace(/^Paroles de la chanson.*$/m, '');
            lyrics = lyrics.replace(/^Lyrics of the song.*$/m, '');
            return { source: 'lyrics.ovh', plainLyrics: lyrics.trim() };
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function fetchLyricsMultiSource(artist, title) {
    console.log(`🔍 Поиск текста для: ${artist} - ${title}`);
    
    const sources = [
        { name: 'LRCLIB', fn: () => fetchFromLRCLIB(artist, title), wantsSynced: true },
        { name: 'Lyrics.ovh', fn: () => fetchFromLyricsOvh(artist, title), wantsSynced: false },
        { name: 'Genius', fn: () => getLyricsFromGenius(artist, title), wantsSynced: false },
        { name: 'Amdm', fn: () => getLyricsFromAmdm(artist, title), wantsSynced: false }
    ];
    
    for (const source of sources) {
        try {
            const result = await source.fn();
            if (result) {
                if (source.wantsSynced && result.syncedLyrics) {
                    console.log(`✅ Найден синхронизированный текст через ${source.name}`);
                    return { syncedLyrics: result.syncedLyrics };
                } else if (!source.wantsSynced && (result.plainLyrics || (typeof result === 'string' && result))) {
                    const plainText = result.plainLyrics || result;
                    if (plainText && plainText.length > 50) {
                        console.log(`✅ Найден обычный текст через ${source.name}`);
                        return { plainLyrics: plainText };
                    }
                }
            }
        } catch (err) {
            console.log(`   ${source.name} ошибка: ${err.message}`);
        }
    }
    return null;
}

// ============= AUTH ENDPOINTS =============

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
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        setAuthCookie(res, token);
        
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

// Логин
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
        
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        setAuthCookie(res, token);
        
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

// Google Auth
app.post("/api/auth/google", async (req, res) => {
    try {
        const { token } = req.body;
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        if (!payload?.email) {
            return res.status(401).json({ message: "Invalid Google token" });
        }
        
        let userQuery = await pool.query(`SELECT * FROM users WHERE email = $1`, [payload.email]);
        let user = userQuery.rows[0];
        
        if (!user) {
            const created = await pool.query(
                `INSERT INTO users (email, first_name, last_name, profile_image_url, google_id)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [payload.email, payload.given_name, payload.family_name, payload.picture, payload.sub]
            );
            user = created.rows[0];
        }
        
        const accessToken = jwt.sign(
            { userId: user.id },
            JWT_SECRET,
            { expiresIn: "30d" }
        );
        
        setAuthCookie(res, accessToken);
         res.json({ 
      success: true,
      accessToken, 
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        profileImageUrl: user.profile_image_url
      }
    });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Google auth failed" });
    }
});

// Выход
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax'
    });
    res.json({ success: true });
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

// Обновить профиль
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

// Загрузка аватара
app.post('/api/user/avatar', requireAuth, uploadAvatar.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await pool.query('UPDATE users SET profile_image_url = $1, updated_at = NOW() WHERE id = $2', [avatarUrl, req.userId]);
    res.json({ avatarUrl });
});

// Удаление аватара
app.delete('/api/user/avatar', requireAuth, async (req, res) => {
    await pool.query('UPDATE users SET profile_image_url = NULL, updated_at = NOW() WHERE id = $1', [req.userId]);
    res.json({ success: true });
});

// ============= TRACKS ENDPOINTS =============

// Получить все треки
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
            created_at: track.created_at,
            genre: track.genre,
            mood: track.mood
        }));
        
        res.json(tracks);
    } catch (error) {
        console.error('Error fetching tracks:', error);
        res.status(500).json({ error: 'Failed to fetch tracks' });
    }
});

// ============= FAVORITES ENDPOINTS =============

app.get('/api/favorites', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT t.*, a.name as artist_name FROM tracks t
             LEFT JOIN artists a ON t.artist_id = a.id
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

// ============= PLAYLISTS ENDPOINTS =============

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

app.post('/api/playlists', requireAuth, async (req, res) => {
    const { name, description } = req.body;
    
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
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating playlist:', error);
        res.status(500).json({ error: 'Failed to create playlist', details: error.message });
    }
});

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

// ============= PLAYS (HISTORY) ENDPOINTS =============

app.post('/api/plays', requireAuth, async (req, res) => {
    const { trackId } = req.body;
    try {
        await pool.query(
            'INSERT INTO plays (id, user_id, track_id, played_at) VALUES (gen_random_uuid(), $1, $2, NOW())',
            [req.userId, trackId]
        );
        await pool.query('UPDATE tracks SET play_count = play_count + 1 WHERE id = $1', [trackId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving play:', error);
        res.status(500).json({ error: 'Failed to save play history' });
    }
});

app.get('/api/user/history', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.played_at,
                t.id as track_id,
                t.title,
                t.duration,
                t.genre,
                t.mood,
                a.name as artist_name,
                t.cover_url
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN artists a ON t.artist_id = a.id
            WHERE p.user_id = $1
            ORDER BY p.played_at DESC
            LIMIT 50
        `, [req.userId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch listening history' });
    }
});

// ============= STATS ENDPOINTS =============

app.get('/api/user/stats', requireAuth, async (req, res) => {
    try {
        // Базовые счётчики
        const tracksResult = await pool.query(
            `SELECT COUNT(*) FROM tracks WHERE user_id = $1`,
            [req.userId]
        );
        
        const favoritesResult = await pool.query(
            'SELECT COUNT(*) FROM favorites WHERE user_id = $1',
            [req.userId]
        );
        
        const playlistsResult = await pool.query(
            'SELECT COUNT(*) FROM playlists WHERE user_id = $1',
            [req.userId]
        );
        
        const playsResult = await pool.query(
            'SELECT COUNT(*) FROM plays WHERE user_id = $1',
            [req.userId]
        );

        // Время прослушивания (сумма duration всех plays)
        const listeningTimeResult = await pool.query(`
            SELECT COALESCE(SUM(t.duration), 0) as total_seconds
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            WHERE p.user_id = $1
        `, [req.userId]);

        // Любимый жанр
        const favoriteGenreResult = await pool.query(`
            SELECT t.genre, COUNT(*) as count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            WHERE p.user_id = $1 AND t.genre IS NOT NULL AND t.genre != ''
            GROUP BY t.genre
            ORDER BY count DESC
            LIMIT 1
        `, [req.userId]);

        // Любимое настроение
        const favoriteMoodResult = await pool.query(`
            SELECT t.mood, COUNT(*) as count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            WHERE p.user_id = $1 AND t.mood IS NOT NULL AND t.mood != ''
            GROUP BY t.mood
            ORDER BY count DESC
            LIMIT 1
        `, [req.userId]);

        // Серия дней ( streak ) — сколько дней подряд слушал
        const streakResult = await pool.query(`
            WITH daily_plays AS (
                SELECT DISTINCT DATE(played_at) as play_date
                FROM plays
                WHERE user_id = $1
                ORDER BY play_date DESC
            ),
            streak_calc AS (
                SELECT play_date,
                       play_date - (ROW_NUMBER() OVER (ORDER BY play_date DESC))::int AS streak_group
                FROM daily_plays
            )
            SELECT COUNT(*) as streak
            FROM streak_calc
            WHERE streak_group = (SELECT streak_group FROM streak_calc LIMIT 1)
        `, [req.userId]);
        
        res.json({
            generatedTracks: parseInt(tracksResult.rows[0].count) || 0,
            favorites: parseInt(favoritesResult.rows[0].count) || 0,
            playlists: parseInt(playlistsResult.rows[0].count) || 0,
            totalPlays: parseInt(playsResult.rows[0].count) || 0,
            listeningTime: Math.floor(parseInt(listeningTimeResult.rows[0].total_seconds) / 60),
            streak: parseInt(streakResult.rows[0]?.streak) || 0,
            favoriteGenre: favoriteGenreResult.rows[0]?.genre || 'Недостаточно данных',
            favoriteMood: favoriteMoodResult.rows[0]?.mood || 'Недостаточно данных'
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to get user stats' });
    }
});

app.get('/api/user/listening-stats', requireAuth, async (req, res) => {
    try {
        const totalPlays = await pool.query(
            'SELECT COUNT(*) FROM plays WHERE user_id = $1',
            [req.userId]
        );
        
        const topTracks = await pool.query(`
            SELECT 
                t.id,
                t.title,
                a.name as artist_name,
                COUNT(*) as play_count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN artists a ON t.artist_id = a.id
            WHERE p.user_id = $1
            GROUP BY t.id, t.title, a.name
            ORDER BY play_count DESC
            LIMIT 5
        `, [req.userId]);
        
        const topGenres = await pool.query(`
            SELECT 
                t.genre,
                COUNT(*) as play_count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            WHERE p.user_id = $1 AND t.genre IS NOT NULL AND t.genre != ''
            GROUP BY t.genre
            ORDER BY play_count DESC
            LIMIT 3
        `, [req.userId]);
        
        const topArtists = await pool.query(`
            SELECT 
                a.name,
                COUNT(*) as play_count
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            LEFT JOIN artists a ON t.artist_id = a.id
            WHERE p.user_id = $1 AND a.name IS NOT NULL
            GROUP BY a.name
            ORDER BY play_count DESC
            LIMIT 3
        `, [req.userId]);
        
        const last7Days = await pool.query(`
            SELECT 
                DATE(played_at) as date,
                COUNT(*) as plays
            FROM plays
            WHERE user_id = $1 AND played_at > NOW() - INTERVAL '7 days'
            GROUP BY DATE(played_at)
            ORDER BY date DESC
        `, [req.userId]);
        
        res.json({
            totalPlays: parseInt(totalPlays.rows[0].count) || 0,
            topTracks: topTracks.rows,
            topGenres: topGenres.rows,
            topArtists: topArtists.rows,
            last7Days: last7Days.rows
        });
    } catch (error) {
        console.error('Error fetching listening stats:', error);
        res.status(500).json({ error: 'Failed to fetch listening statistics' });
    }
});

// ============= RECOMMENDATIONS ENDPOINTS =============
app.get('/api/recommendations', requireAuth, async (req, res) => {
    try {
        // Получаем жанры которые слушал пользователь
        const userGenres = await pool.query(`
            SELECT DISTINCT t.genre
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            WHERE p.user_id = $1 AND t.genre IS NOT NULL
            LIMIT 5
        `, [req.userId]);
        
        if (userGenres.rows.length === 0) {
            // Если ничего не слушал — просто популярные треки
            const popular = await pool.query(`
                SELECT 
                    t.id as track_id,
                    t.title,
                    a.name as artist_name,
                    t.genre,
                    t.mood,
                    t.tempo,
                    t.duration,
                    t.cover_url,
                    'Popular' as reason
                FROM tracks t
                LEFT JOIN artists a ON t.artist_id = a.id
                ORDER BY t.play_count DESC
                LIMIT 20
            `);
            
            return res.json(popular.rows);
        }
        
        // Рекомендуем треки похожего жанра
        const genres = userGenres.rows.map(r => r.genre);
        const recommended = await pool.query(`
            SELECT 
                t.id as track_id,
                t.title,
                a.name as artist_name,
                t.genre,
                t.mood,
                t.tempo,
                t.duration,
                t.cover_url,
                'Based on your taste' as reason
            FROM tracks t
            LEFT JOIN artists a ON t.artist_id = a.id
            WHERE t.genre = ANY($1)
            AND t.id NOT IN (
                SELECT track_id FROM plays WHERE user_id = $2
            )
            ORDER BY t.play_count DESC
            LIMIT 20
        `, [genres, req.userId]);
        
        res.json(recommended.rows);
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});


app.post('/api/recommendations/refresh', requireAuth, async (req, res) => {
    res.json({ success: true, message: 'Recommendations refresh started' });
});

app.get('/api/user/activity', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        // Последние прослушивания
        const plays = await pool.query(`
            SELECT 
                'play' as type,
                t.title,
                p.played_at as timestamp,
                t.genre as details
            FROM plays p
            JOIN tracks t ON p.track_id = t.id
            WHERE p.user_id = $1
            ORDER BY p.played_at DESC
            LIMIT $2
        `, [req.userId, limit]);

        // Последние добавления в избранное
        const favorites = await pool.query(`
            SELECT 
                'favorite' as type,
                t.title,
                f.created_at as timestamp,
                NULL as details
            FROM favorites f
            JOIN tracks t ON f.track_id = t.id
            WHERE f.user_id = $1
            ORDER BY f.created_at DESC
            LIMIT $2
        `, [req.userId, Math.floor(limit / 2)]);

        // Последние созданные плейлисты
        const playlists = await pool.query(`
            SELECT 
                'create' as type,
                name as title,
                created_at as timestamp,
                'Плейлист' as details
            FROM playlists
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [req.userId, Math.floor(limit / 3)]);

        // Объединяем и сортируем по времени
        const allActivity = [
            ...plays.rows,
            ...favorites.rows,
            ...playlists.rows
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
         .slice(0, limit);

        res.json({ activities: allActivity });
    } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({ error: 'Failed to get activity' });
    }
});
// ============= LYRICS ENDPOINTS =============

app.get('/api/lyrics', async (req, res) => {
    const { artist, title } = req.query;
    if (!artist || !title) {
        return res.status(400).json({ error: 'Artist and title are required' });
    }
    
    try {
        const lyricsData = await fetchLyricsMultiSource(artist, title);
        if (lyricsData) {
            const lyrics = lyricsData.syncedLyrics || lyricsData.plainLyrics;
            return res.json({ lyrics, source: 'multisource' });
        } else {
            return res.json({ lyrics: null, error: 'Lyrics not found' });
        }
    } catch (error) {
        console.error('Ошибка получения текста:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/lyrics-lrc', async (req, res) => {
    const { artist, title } = req.query;
    console.log(`🎤 Запрос текста: ${artist} - ${title}`);

    try {
        const lrcRes = await axios.get(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
        if (lrcRes.data?.syncedLyrics) {
            return res.json({ syncedLyrics: lrcRes.data.syncedLyrics });
        }
    } catch (e) { /* игнорируем */ }
    
    const amdmLyrics = await getLyricsFromAmdm(artist, title);
    if (amdmLyrics) {
        return res.json({ plainLyrics: amdmLyrics });
    }
    
    try {
        const geniusLyrics = await getLyricsFromGenius(artist, title);
        if (geniusLyrics) {
            return res.json({ plainLyrics: geniusLyrics });
        }
    } catch (e) { /* игнорируем */ }

    return res.json({ plainLyrics: `Текст для "${title}" не найден.` });
});

// ============= ARTIST ENDPOINTS =============

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

// ============= GENERATE ENDPOINT =============

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

// ============= USER PREFERENCES =============

app.get('/api/user/preferences', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT preferred_genres, preferred_artists, preferred_moods, min_tempo, max_tempo
            FROM user_preferences
            WHERE user_id = $1
        `, [req.userId]);
        
        res.json(result.rows[0] || {});
    } catch (error) {
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

// ============= ЗАПУСК =============
app.listen(port, () => {
    console.log(`🎵 MelodixAI API Server running on http://localhost:${port}`);
    console.log(`   POST /api/auth/register - Register`);
    console.log(`   POST /api/auth/login - Login`);
    console.log(`   POST /api/auth/logout - Logout`);
    console.log(`   GET  /api/tracks - Get tracks`);
    console.log(`   GET  /api/lyrics - Get lyrics`);
    console.log(`   GET  /api/playlists - Get playlists`);
    console.log(`   GET  /api/favorites - Get favorites`);
    console.log(`   🔐 JWT + httpOnly cookies enabled`);
});