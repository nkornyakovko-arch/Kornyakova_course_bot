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

const PRODAMUS_CHECKOUT_URL = process.env.PRODAMUS_CHECKOUT_URL; // Пример: https://t.me/Kornyakova_course_bot?start=pay_{USER_ID}

const PORT = process.env.PORT || 10000;

// Проверка обязательных переменных
if (!BOT_TOKEN || !WELCOME_VIDEO_FILE_ID || !PRODAMUS_CHECKOUT_URL) {
  console.error('❌ Ошибка: не все переменные заданы в .env');
  process.exit(1);
}

// Список платных видео
const PAID_VIDEOS = [
  { fileId: VIDEO_1_FILE_ID, caption: '🎥 Урок 1: Подготовка ногтевой пластины' },
  { fileId: VIDEO_2_FILE_ID, caption: '🎥 Урок 2: Нанесение базы и цвета' },
  { fileId: VIDEO_3_FILE_ID, caption: '🎥 Урок 3: Финишное покрытие и уход' }
].filter(video => video.fileId); // исключаем пустые

// Хранилище пользователей (в памяти)
const users = {}; // { userId: { paidAt: timestamp, lastVideoSent: индекс } }

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

// === ЛОГИКА ВЫДАЧИ ВИДЕО ПОСЛЕ ОПЛАТЫ ===

 function checkAndSendDueVideo(userId, chatId) {
   const user = users[userId];
   if (!user) return;

   const daysSincePayment = Math.floor((Date.now() - user.paidAt) / (24 * 60 * 60 * 1000));
   const nextVideoIndex = Math.min(daysSincePayment, PAID_VIDEOS.length - 1);

   if (nextVideoIndex > user.lastVideoSent && PAID_VIDEOS[nextVideoIndex]) {
     const video = PAID_VIDEOS[nextVideoIndex];
    sendVideo(chatId, video.fileId, video.caption);
    user.lastVideoSent = nextVideoIndex;
  }
}

// === ОБРАБОТКА СООБЩЕНИЙ ===

function handleUpdate(update) {
  if (!update.message) return;

  const { message } = update;
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text || '';

  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const param = parts[1];

    // ——————— Активация после оплаты: отправляем ВСЕ видео сразу ———————
    if (param && param.startsWith('pay_')) {
      const expectedUserId = parseInt(param.replace('pay_', ''), 10);
      if (expectedUserId === userId) {
        // Отправляем все платные видео
        PAID_VIDEOS.forEach(video => {
          sendVideo(chatId, video.fileId, video.caption);
        });
        sendMessage(chatId, '🎉 Поздравляю! Вы получили весь курс. Удачи в обучении!');
        return;
      } else {
        sendMessage(chatId, '⚠️ Эта ссылка не для вас.');
        return;
      }
    }

    // ——————— Обычный запуск: приветствие + оплата ———————
    sendVideo(chatId, WELCOME_VIDEO_FILE_ID, '🎬 Добро пожаловать! Это бесплатное вступление.');

    const payUrl = PRODAMUS_CHECKOUT_URL.replace('{USER_ID}', userId);
    const paymentMessage = `🔓 Чтобы получить полный курс, оплатите доступ:\n\n<a href="${payUrl}">👉 Перейти к оплате</a>`;
    sendMessage(chatId, paymentMessage);
    return;
  }

  // На всё остальное — подсказка
  sendMessage(chatId, 'Напишите /start, чтобы начать.');
}
  {
    // ——————— Обычный запуск: приветствие + оплата ———————
    sendVideo(chatId, WELCOME_VIDEO_FILE_ID, '🎬 Добро пожаловать! Это бесплатное вступление.');

    // Генерация ссылки с подстановкой USER_ID
    const payUrl = PRODAMUS_CHECKOUT_URL.replace('{USER_ID}', userId);
    const paymentMessage = `🔓 Чтобы получить полный курс, оплатите доступ:\n\n<a href="${payUrl}">👉 Перейти к оплате</a>`;
    sendMessage(chatId, paymentMessage);
    return;
  }

  // Если пользователь уже оплатил — отправляем доступные видео
  if (users[userId]) {
    checkAndSendDueVideo(userId, chatId);
    return;
  }
{
  // На всё остальное — подсказка
  sendMessage(chatId, 'Напишите /start, чтобы начать.');
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

// === УСТАНОВКА WEBHOOK ===

function setWebhook(url) {
  const fullUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(url)}`;
  https.get(fullUrl, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('✅ Webhook установлен на:', url);
    });
  }).on('error', (e) => {
    console.error('❌ Не удалось установить webhook:', e.message);
  });
}

// === ЗАПУСК ===

server.listen(PORT, () => {
  console.log(`✅ Бот запущен на порту ${PORT}`);
  const publicUrl = process.env.RENDER_EXTERNAL_URL || `https://your-bot.onrender.com`;
  setWebhook(publicUrl);
});