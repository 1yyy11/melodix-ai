
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Client } = require('pg');

const pool = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'melodix',
    password: 'postgres123',
    port: 5432,
});

const GENIUS_ACCESS_TOKEN = '0yMlIu83IbruTlz6GvVv6jIndVTIXSWfLf4I8ET0riafRW9IE5BU0ROfE7jL5Llc';
const COVERS_PATH = path.join(__dirname, 'uploads/covers');

if (!fs.existsSync(COVERS_PATH)) fs.mkdirSync(COVERS_PATH, { recursive: true });

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
        console.log(`      ⚠️ Ошибка скачивания: ${error.message}`);
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

async function updateArtistCovers() {
    console.log('\n🎨 Загрузка обложек исполнителей из Genius API...\n');
    
    const result = await pool.query('SELECT id, name FROM artists');
    
    for (const artist of result.rows) {
        console.log(`   📸 ${artist.name}...`);
        
        const geniusResult = await searchGenius(artist.name);
        const imageUrl = geniusResult?.primary_artist?.image_url;
        
        if (imageUrl) {
            const filename = `${artist.id}_artist.jpg`;
            const coverUrl = await downloadImage(imageUrl, filename);
            if (coverUrl) {
                await pool.query('UPDATE artists SET cover_url = $1 WHERE id = $2', [coverUrl, artist.id]);
                console.log(`      ✅ Обложка добавлена!`);
            }
        } else {
            // Заглушка с именем
            const placeholderUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=6c63ff&color=fff&size=200`;
            const filename = `${artist.id}_artist.png`;
            const coverUrl = await downloadImage(placeholderUrl, filename);
            if (coverUrl) {
                await pool.query('UPDATE artists SET cover_url = $1 WHERE id = $2', [coverUrl, artist.id]);
                console.log(`      ⚠️ Использована заглушка`);
            }
        }
        
        await new Promise(r => setTimeout(r, 500));
    }
}

async function updateTrackCovers() {
    console.log('\n🎨 Загрузка обложек треков из Genius API...\n');
    
    const result = await pool.query(`
        SELECT t.id, t.title, a.name as artist_name
        FROM tracks t
        JOIN artists a ON t.artist_id = a.id
    `);
    
    for (const track of result.rows) {
        console.log(`   📸 ${track.title} - ${track.artist_name}...`);
        
        const geniusResult = await searchGenius(`${track.artist_name} ${track.title}`);
        const imageUrl = geniusResult?.song_art_image_url || geniusResult?.header_image_url;
        
        if (imageUrl) {
            const filename = `${track.id}_cover.jpg`;
            const coverUrl = await downloadImage(imageUrl, filename);
            if (coverUrl) {
                await pool.query('UPDATE tracks SET cover_url = $1 WHERE id = $2', [coverUrl, track.id]);
                console.log(`      ✅ Обложка добавлена!`);
            }
        } else {
            console.log(`      ⚠️ Обложка не найдена`);
        }
        
        await new Promise(r => setTimeout(r, 500));
    }
}

async function main() {
    await pool.connect();
    console.log('✅ PostgreSQL подключен');
    
    await updateArtistCovers();
    await updateTrackCovers();
    
    console.log('\n✅ Обновление обложек из Genius завершено!');
    await pool.end();
}

main().catch(console.error);
