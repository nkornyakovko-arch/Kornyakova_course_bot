// bot.js — безопасный Telegram-бот на чистом Node.js
require('dotenv').config();
const http = require('http');
const https = require('https');

// === ЗАГРУЗКА НАСТРОЕК ИЗ .env ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const WELCOME_VIDEO_FILE_ID = process.env.WELCOME_VIDEO_FILE_ID;

const VIDEO_1_FILE_ID = process.env.VIDEO_1_FILE_ID;
const VIDEO_2_FILE_ID = process.env.VIDEO_2_FILE_ID;
const VIDEO_3_FILE_ID = process.env.VIDEO_3_FILE_ID;

const PRODAMUS_CHECKOUT_URL = process.env.PRODAMUS_CHECKOUT_URL;

const PORT = process.env.PORT || 10000;

// Проверка обязательных переменных
if (!BOT_TOKEN || !WELCOME_VIDEO_FILE_ID || !PRODAMUS_CHECKOUT_URL) {
  console.error('❌ Ошибка: не все переменные заданы в .env');
  process.exit(1);
}

// Список платных видео (можно легко расширить)
const PAID_VIDEOS = [
  { fileId: VIDEO_1_FILE_ID, caption: '🎥 Урок 1: Подготовка ногтевой пластины' },
  { fileId: VIDEO_2_FILE_ID, caption: '🎥 Урок 2: Нанесение базы и цвета' },
  { fileId: VIDEO_3_FILE_ID, caption: '🎥 Урок 3: Финишное покрытие и уход' }
].filter(video => video.fileId); // исключаем пустые

// Память: кто оплатил (в продакшене — заменить на БД)
const paidUsers = new Set();

// === ФУНКЦИИ ОТПРАВКИ ===

function sendVideo(chatId, fileId, caption = '') {
  const data = JSON.stringify({
    chat_id: chatId,
    video: fileId,
    caption,
    parse_mode: 'HTML'
  });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendVideo`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  req.on('error', (e) => console.error('⚠️ Ошибка отправки видео:', e.message));
  req.write(data);
  req.end();
}

function sendMessage(chatId, text) {
  const data = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'HTML'
  });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  req.on('error', (e) => console.error('⚠️ Ошибка отправки текста:', e.message));
  req.write(data);
  req.end();
}

// Установка webhook (для хостинга)
function setWebhook(url) {
  const webhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(url)}`;
  https.get(webhookUrl, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('✅ Webhook установлен');
    });
  }).on('error', (e) => {
    console.error('❌ Не удалось установить webhook:', e.message);
  });
}

// === ОБРАБОТКА СООБЩЕНИЙ ===

function handleUpdate(update) {
  if (!update.message) return;

  const { message } = update;
  const chatId = message.chat.id;
  const userId = message.from.id;

  if (message.text === '/start') {
    const parts = message.text.split(' ');
    const param = parts[1];

    // Обработка возврата после оплаты: /start paid_123456789
    if (param && param.startsWith('paid_')) {
      const paidUserId = Number(param.slice(5)); // "paid_123" → 123
      if (!isNaN(paidUserId) && paidUserId === userId) {
        paidUsers.add(userId);
        sendMessage(chatId, '✅ Спасибо за покупку! Вот ваш курс:');
        
        PAID_VIDEOS.forEach(video => {
          sendVideo(chatId, video.fileId, video.caption);
        });
        return;
      }
    }

    // Обычный старт — приветствие + ссылка на оплату
    sendVideo(chatId, WELCOME_VIDEO_FILE_ID, '🎬 Добро пожаловать! Это бесплатное вступление.');

    // Генерация ссылки: после оплаты Prodamus перенаправит сюда
    // В Prodamus: в настройках "Ссылка после оплаты" укажи:
    // https://t.me/YourBotName?start=paid_{USER_ID}
    const prodamusLink = PRODAMUS_CHECKOUT_URL; // Prodamus сам подставит USER_ID, если настроить
    const text = `🔓 Чтобы получить полный курс, оплатите доступ:\n\n<a href="${prodamusLink}">👉 Перейти к оплате</a>`;
    sendMessage(chatId, text);
  }
}

// === HTTP-СЕРВЕР ===

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const update = JSON.parse(body);
        handleUpdate(update);
        res.writeHead(200);
        res.end('OK');
      } catch (e) {
        console.error('❌ Ошибка обработки:', e.message);
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
  } else {
    res.writeHead(200);
    res.end('✅ Бот запущен');
  }
});

// === ЗАПУСК ===

server.listen(PORT, () => {
  console.log(`✅ Бот запущен на порту ${PORT}`);
  const publicUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setWebhook(publicUrl);
});