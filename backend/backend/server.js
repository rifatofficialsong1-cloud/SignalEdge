require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const axios = require('axios');
const { RSI } = require('technicalindicators');
const cron = require('node-cron');

// এখানে আমি সরাসরি লিঙ্ক বসিয়ে দিচ্ছি যাতে কোনো মিস না হয়
const MONGO_URI = 'mongodb+srv://mdrifat0pq_db_user:JNC8m3E0dFGyUUEu@cluster0.oik4mbq.mongodb.net/?retryWrites=true&w=majority';
const bot = new Telegraf(process.env.BOT_TOKEN);

const User = mongoose.model('User', new mongoose.Schema({
    chatId: Number,
    lang: { type: String, default: 'en' }
}));

const translations = {
    en: { start: "Choose a coin:", buy: "Strong Buy 🚀", sell: "Strong Sell 📉", wait: "Neutral ⚖️" },
    bn: { start: "একটি কয়েন বেছে নিন:", buy: "এখনই কিনুন 🚀", sell: "বিক্রি করুন 📉", wait: "অপেক্ষা করুন ⚖️" },
    ru: { start: "Выберите монету:", buy: "Покупать 🚀", sell: "Продавать 📉", wait: "Нейтрально ⚖️" },
    ar: { start: "اختر عملة:", buy: "شراء قوي 🚀", sell: "بيع قوي 📉", wait: "محايد ⚖️" },
    zh: { start: "选择币种:", buy: "强力买入 🚀", sell: "强力卖出 📉", wait: "中立 ⚖️" }
};

let marketData = {};

async function updateData() {
    try {
        const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true');
        res.data.forEach(coin => {
            const prices = coin.sparkline_in_7d.price;
            const rsiVal = RSI.calculate({ values: prices, period: 14 });
            const lastRsi = rsiVal[rsiVal.length - 1];
            marketData[coin.symbol.toUpperCase()] = {
                price: coin.current_price,
                rsi: lastRsi ? lastRsi.toFixed(2) : "N/A",
                action: lastRsi < 35 ? "buy" : lastRsi > 65 ? "sell" : "wait"
            };
        });
        console.log("✅ Market Data Synced");
    } catch (e) { console.log("❌ API Error"); }
}

cron.schedule('*/3 * * * *', updateData);
updateData();

bot.start(async (ctx) => {
    await User.findOneAndUpdate({ chatId: ctx.chat.id }, { chatId: ctx.chat.id }, { upsert: true });
    ctx.reply("Select Language / ভাষা:", Markup.inlineKeyboard([
        [Markup.button.callback('🇺🇸 English', 'lang_en'), Markup.button.callback('🇧🇩 বাংলা', 'lang_bn')],
        [Markup.button.callback('🇷🇺 Russian', 'lang_ru'), Markup.button.callback('🇸🇦 Arabic', 'lang_ar')],
        [Markup.button.callback('🇨🇳 Chinese', 'lang_zh')]
    ]));
});

bot.action(/lang_(.+)/, async (ctx) => {
    const lang = ctx.match[1];
    await User.findOneAndUpdate({ chatId: ctx.chat.id }, { lang: lang });
    ctx.reply(translations[lang].start, Markup.keyboard([['BTC', 'ETH', 'SOL']]).resize());
});

bot.hears(['BTC', 'ETH', 'SOL'], async (ctx) => {
    const user = await User.findOne({ chatId: ctx.chat.id });
    const coin = ctx.message.text;
    const data = marketData[coin];
    if (!data) return ctx.reply("Wait a moment...");
    ctx.replyWithMarkdown(`📊 *${coin}*\n💰 Price: $${data.price}\n📉 RSI: ${data.rsi}\n🚀 Action: ${translations[user.lang || 'en'][data.action]}`);
});

mongoose.connect(MONGO_URI).then(() => {
    console.log("🚀 DB Connected Successfully!");
    bot.launch();
});
