const axios = require('axios');
const readline = require('readline');

// НАСТРОЙКИ - ЗАМЕНИ НА СВОИ!
const CLIENT_ID = '54529230';  // ID твоего приложения VK
const LOGIN = '+375445725495';         // Твой номер телефона
const PASSWORD = 'J9j-35P-pZu-s9S';      // Твой пароль

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function getVKToken() {
    try {
        console.log('🔑 Получаем токен VK...\n');
        
        // 1. Получаем токен через прямой запрос (работает для standalone-приложений)
        const response = await axios.get('https://oauth.vk.com/token', {
            params: {
                grant_type: 'password',
                client_id: CLIENT_ID,
                username: LOGIN,
                password: PASSWORD,
                v: '5.131',
                scope: 'audio,offline'
            }
        });
        
        const token = response.data.access_token;
        const userId = response.data.user_id;
        
        console.log(`\n✅ Токен успешно получен!`);
        console.log(`👤 User ID: ${userId}`);
        console.log(`🔑 Токен: ${token}\n`);
        console.log('Скопируй этот токен и добавь в .env:');
        console.log(`VK_ACCESS_TOKEN=${token}`);
        
        return token;
        
    } catch (error) {
        console.error('❌ Ошибка получения токена:', error.response?.data || error.message);
        console.log('\n⚠️ Если ошибка "incorrect app", попробуй получить токен вручную:');
        console.log(`1. Перейди по ссылке: https://oauth.vk.com/authorize?client_id=${CLIENT_ID}&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=audio,offline&response_type=token&v=5.131`);
        console.log('2. Разреши доступ');
        console.log('3. Скопируй access_token из адресной строки\n');
        
        rl.question('Вставь токен вручную: ', (manualToken) => {
            console.log(`\n✅ Сохрани в .env: VK_ACCESS_TOKEN=${manualToken}`);
            rl.close();
        });
    }
}

getVKToken();