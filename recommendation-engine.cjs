const { Client } = require('pg');

const pool = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'melodix',
    password: 'postgres123',
    port: 5432,
});

// Анализ предпочтений пользователя на основе истории и избранного
async function analyzeUserPreferences(userId) {
    console.log(`\n📊 Анализ предпочтений пользователя ${userId}...`);
    
    // Собираем статистику из истории прослушиваний
    const historyResult = await pool.query(`
        SELECT 
            t.genre,
            t.mood,
            t.tempo,
            a.name as artist_name
        FROM plays p
        JOIN tracks t ON p.track_id = t.id
        JOIN artists a ON t.artist_id = a.id
        WHERE p.user_id = $1
        ORDER BY p.played_at DESC
    `, [userId]);
    
    // Собираем статистику из избранного
    const favResult = await pool.query(`
        SELECT 
            t.genre,
            t.mood,
            t.tempo,
            a.name as artist_name
        FROM favorites f
        JOIN tracks t ON f.track_id = t.id
        JOIN artists a ON t.artist_id = a.id
        WHERE f.user_id = $1
    `, [userId]);
    
    const allData = [...historyResult.rows, ...favResult.rows];
    
    if (allData.length === 0) {
        console.log('   ⚠️ Нет данных для анализа. Использую популярные треки.');
        return null;
    }
    
    // Анализируем жанры
    const genreStats = {};
    const moodStats = {};
    const artistStats = {};
    let totalTempo = 0;
    let tempoCount = 0;
    
    for (const item of allData) {
        if (item.genre && item.genre !== 'unknown') {
            genreStats[item.genre] = (genreStats[item.genre] || 0) + 1;
        }
        if (item.mood && item.mood !== 'unknown') {
            moodStats[item.mood] = (moodStats[item.mood] || 0) + 1;
        }
        if (item.artist_name) {
            artistStats[item.artist_name] = (artistStats[item.artist_name] || 0) + 1;
        }
        if (item.tempo) {
            totalTempo += item.tempo;
            tempoCount++;
        }
    }
    
    // Топ-3 жанров, настроений, исполнителей
    const topGenres = Object.entries(genreStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(g => g[0]);
    
    const topMoods = Object.entries(moodStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(m => m[0]);
    
    const topArtists = Object.entries(artistStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(a => a[0]);
    
    const avgTempo = tempoCount > 0 ? Math.round(totalTempo / tempoCount) : 120;
    
    // Сохраняем предпочтения
    await pool.query(`
        INSERT INTO user_preferences (user_id, preferred_genres, preferred_artists, preferred_moods, min_tempo, max_tempo, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            preferred_genres = EXCLUDED.preferred_genres,
            preferred_artists = EXCLUDED.preferred_artists,
            preferred_moods = EXCLUDED.preferred_moods,
            min_tempo = EXCLUDED.min_tempo,
            max_tempo = EXCLUDED.max_tempo,
            updated_at = NOW()
    `, [userId, topGenres, topArtists, topMoods, Math.max(0, avgTempo - 20), avgTempo + 20]);
    
    console.log(`   ✅ Любимые жанры: ${topGenres.join(', ') || 'не определены'}`);
    console.log(`   ✅ Любимое настроение: ${topMoods.join(', ') || 'не определено'}`);
    console.log(`   ✅ Любимые исполнители: ${topArtists.join(', ') || 'не определены'}`);
    console.log(`   ✅ Предпочитаемый темп: ${avgTempo} BPM`);
    
    return { topGenres, topMoods, topArtists, avgTempo };
}

// Генерация рекомендаций
async function generateRecommendations(userId) {
    console.log(`\n🎯 Генерация рекомендаций для пользователя ${userId}...`);
    
    // Получаем предпочтения
    const prefsResult = await pool.query(`
        SELECT preferred_genres, preferred_artists, preferred_moods, min_tempo, max_tempo
        FROM user_preferences
        WHERE user_id = $1
    `, [userId]);
    
    let genres = [], artists = [], moods = [];
    let minTempo = 0, maxTempo = 200;
    
    if (prefsResult.rows.length > 0) {
        const prefs = prefsResult.rows[0];
        genres = prefs.preferred_genres || [];
        artists = prefs.preferred_artists || [];
        moods = prefs.preferred_moods || [];
        minTempo = prefs.min_tempo || 0;
        maxTempo = prefs.max_tempo || 200;
    }
    
    // Треки, которые уже слушал/лайкал пользователь
    const excludeResult = await pool.query(`
        SELECT track_id FROM plays WHERE user_id = $1
        UNION
        SELECT track_id FROM favorites WHERE user_id = $1
    `, [userId]);
    
    const excludeIds = excludeResult.rows.map(r => r.track_id);
    if (excludeIds.length === 0) excludeIds.push('none');
    
    const recommendations = [];
    
    // 1. По жанрам (вес 10)
    if (genres.length > 0) {
        const genreTracks = await pool.query(`
            SELECT t.id, t.title, a.name as artist_name, t.genre, t.mood, t.tempo,
                   (10 + COALESCE(t.play_count, 0) / 1000.0) as score
            FROM tracks t
            JOIN artists a ON t.artist_id = a.id
            WHERE t.genre = ANY($1)
              AND t.id != ALL($2)
            ORDER BY t.play_count DESC
            LIMIT 15
        `, [genres, excludeIds]);
        
        for (const track of genreTracks.rows) {
            recommendations.push({
                track_id: track.id,
                score: track.score,
                reason: 'Похожий жанр'
            });
        }
        console.log(`   ✅ По жанрам: ${genreTracks.rows.length} треков`);
    }
    
    // 2. По исполнителям (вес 8)
    if (artists.length > 0) {
        const artistTracks = await pool.query(`
            SELECT t.id, t.title, a.name as artist_name, t.genre, t.mood, t.tempo,
                   (8 + COALESCE(t.play_count, 0) / 1000.0) as score
            FROM tracks t
            JOIN artists a ON t.artist_id = a.id
            WHERE a.name = ANY($1)
              AND t.id != ALL($2)
            ORDER BY t.play_count DESC
            LIMIT 15
        `, [artists, excludeIds]);
        
        for (const track of artistTracks.rows) {
            recommendations.push({
                track_id: track.id,
                score: track.score,
                reason: 'Тот же исполнитель'
            });
        }
        console.log(`   ✅ По исполнителям: ${artistTracks.rows.length} треков`);
    }
    
    // 3. По настроению (вес 5)
    if (moods.length > 0) {
        const moodTracks = await pool.query(`
            SELECT t.id, t.title, a.name as artist_name, t.genre, t.mood, t.tempo,
                   (5 + COALESCE(t.play_count, 0) / 1000.0) as score
            FROM tracks t
            JOIN artists a ON t.artist_id = a.id
            WHERE t.mood = ANY($1)
              AND t.id != ALL($2)
            ORDER BY t.play_count DESC
            LIMIT 15
        `, [moods, excludeIds]);
        
        for (const track of moodTracks.rows) {
            recommendations.push({
                track_id: track.id,
                score: track.score,
                reason: 'Подходящее настроение'
            });
        }
        console.log(`   ✅ По настроению: ${moodTracks.rows.length} треков`);
    }
    
    // 4. По темпу (вес 3)
    const tempoTracks = await pool.query(`
        SELECT t.id, t.title, a.name as artist_name, t.genre, t.mood, t.tempo,
               (3 + COALESCE(t.play_count, 0) / 1000.0) as score
        FROM tracks t
        JOIN artists a ON t.artist_id = a.id
        WHERE t.tempo BETWEEN $1 AND $2
          AND t.id != ALL($3)
        ORDER BY t.play_count DESC
        LIMIT 15
    `, [minTempo, maxTempo, excludeIds]);
    
    for (const track of tempoTracks.rows) {
        recommendations.push({
            track_id: track.id,
            score: track.score,
            reason: 'Похожий темп'
        });
    }
    console.log(`   ✅ По темпу: ${tempoTracks.rows.length} треков`);
    
    // 5. Популярные треки (вес 1) - если мало рекомендаций
    if (recommendations.length < 20) {
        const popularTracks = await pool.query(`
            SELECT t.id, t.title, a.name as artist_name, t.genre, t.mood, t.tempo,
                   (1 + COALESCE(t.play_count, 0) / 1000.0) as score
            FROM tracks t
            JOIN artists a ON t.artist_id = a.id
            WHERE t.id != ALL($1)
            ORDER BY t.play_count DESC
            LIMIT 20
        `, [excludeIds]);
        
        for (const track of popularTracks.rows) {
            recommendations.push({
                track_id: track.id,
                score: track.score,
                reason: 'Популярный трек'
            });
        }
        console.log(`   ✅ Популярные: ${popularTracks.rows.length} треков`);
    }
    
    // Убираем дубликаты и сортируем по score
    const uniqueTracks = new Map();
    for (const rec of recommendations) {
        if (!uniqueTracks.has(rec.track_id) || uniqueTracks.get(rec.track_id).score < rec.score) {
            uniqueTracks.set(rec.track_id, rec);
        }
    }
    
    const topRecommendations = Array.from(uniqueTracks.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
    
    // Сохраняем в БД
    await pool.query(`DELETE FROM recommendations WHERE user_id = $1`, [userId]);
    
    for (const rec of topRecommendations) {
        await pool.query(`
            INSERT INTO recommendations (user_id, track_id, score, reason, created_at, expires_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '7 days')
        `, [userId, rec.track_id, rec.score, rec.reason]);
    }
    
    console.log(`\n   ✅ Сохранено ${topRecommendations.length} рекомендаций`);
    return topRecommendations;
}

// Получить рекомендации для пользователя
async function getRecommendations(userId, limit = 20) {
    const result = await pool.query(`
        SELECT r.*, t.title, a.name as artist_name, t.genre, t.mood, t.tempo, t.duration, t.cover_url
        FROM recommendations r
        JOIN tracks t ON r.track_id = t.id
        JOIN artists a ON t.artist_id = a.id
        WHERE r.user_id = $1 AND r.expires_at > NOW()
        ORDER BY r.score DESC
        LIMIT $2
    `, [userId, limit]);
    
    return result.rows;
}

// Основной процесс
async function main() {
    const userId = process.argv[2] || 'demo-user-123';
    
    await pool.connect();
    console.log('✅ PostgreSQL подключен');
    console.log(`\n🎵 MelodixAI Recommendation Engine`);
    console.log(`👤 Пользователь: ${userId}`);
    
    await analyzeUserPreferences(userId);
    await generateRecommendations(userId);
    
    const recommendations = await getRecommendations(userId, 10);
    
    console.log(`\n📋 ТОП-10 РЕКОМЕНДАЦИЙ:`);
    console.log(`${'='.repeat(60)}`);
    
    for (let i = 0; i < recommendations.length; i++) {
        const rec = recommendations[i];
        console.log(`${i+1}. ${rec.title} — ${rec.artist_name}`);
        console.log(`   🎵 Жанр: ${rec.genre || '?'} | Настроение: ${rec.mood || '?'} | BPM: ${rec.tempo || '?'}`);
        console.log(`   📊 Оценка: ${Math.round(rec.score)} | Причина: ${rec.reason}`);
        console.log('');
    }
    
    await pool.end();
}

main().catch(console.error);