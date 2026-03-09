require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const axios = require('axios');
const { RSI } = require('technicalindicators');
const cron = require('node-cron');

// তোর দেওয়া MongoDB লিঙ্ক আগে থেকেই সেট করা
const MONGO_URI = 'mongodb+srv://mdrifat0pq_db_user:JNC8m3E0dFGyUUEu@cluster0.oik4mbq.mongodb.net/?retryWrites=true&w=majority';
const bot = new Telegraf(process.env.BOT_TOKEN);

// ১. ডাটাবেস সেটআপ
const userSchema = new mongoose.Schema({
    chatId: Number,
    lang: { type: String, default: 'en' },
    plan: { type: String, default: 'free' }
});
const User = mongoose.model('User', userSchema);

// ২. ৫টি ভাষার ডিকশনারি
const translations = {
    en: { start: "Choose a coin:", buy: "Strong Buy 🚀", sell: "Strong Sell 📉", wait: "Neutral ⚖️", profile: "Profile", upgrade: "Upgrade" },
    bn: { start: "একটি কয়েন বেছে নিন:", buy: "এখনই কিনুন 🚀", sell: "বিক্রি করুন 📉", wait: "অপেক্ষা করুন ⚖️", profile: "প্রোফাইল", upgrade: "আপগ্রেড" },
    ru: { start: "Выберите монету:", buy: "Покупать 🚀", sell: "Продавать 📉", wait: "Нейтрально ⚖️", profile: "Профиль", upgrade: "Обновить" },
    ar: { start: "اختر عملة:", buy: "شراء قوي 🚀", sell: "بيع قوي 📉", wait: "محايد ⚖️", profile: "الملف الشخصي", upgrade: "ترقية" },
    zh: { start: "选择币种:", buy: "强力买入 🚀", sell: "强力卖出 📉", wait: "中立 ⚖️", profile: "个人资料", upgrade: "升级" }
};

// ৩. মার্কেট ডেটা ইঞ্জিন (Caching)
let marketData = {};
async function updateData() {
    try {
        const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true');
        res.data.forEach(coin => {
            const prices = coin.sparkline_in_7d.price;
            const rsiVal = RSI.calculate({ values: prices, period: 14 });
            const lastRsi = rsiVal[rsiVal.length - 1];
            marketData[coin.symbol.toUpperCase()] = {
                name: coin.name,
                price: coin.current_price,
                rsi: lastRsi.toFixed(2),
                action: lastRsi < 30 ? "buy" : lastRsi > 70 ? "sell" : "wait"
            };
        });
        console.log("✅ Market Data Updated");
    } catch (e) { console.log("❌ API Error"); }
}
cron.schedule('*/3 * * * *', updateData);
updateData();

// ৪. বটের কাজ শুরু
bot.start(async (ctx) => {
    let user = await User.findOne({ chatId: ctx.chat.id });
    if (!user) user = await User.create({ chatId: ctx.chat.id });
    ctx.reply("Language / ভাষা নির্বাচন করুন:", Markup.inlineKeyboard([
        [Markup.button.callback('🇺🇸 English', 'lang_en'), Markup.button.callback('🇧🇩 বাংলা', 'lang_bn')],
        [Markup.button.callback('🇷🇺 Russian', 'lang_ru'), Markup.button.callback('🇸🇦 Arabic', 'lang_ar')],
        [Markup.button.callback('🇨🇳 Chinese', 'lang_zh')]
    ]));
});

bot.action(/lang_(.+)/, async (ctx) => {
    const lang = ctx.match[1];
    await User.findOneAndUpdate({ chatId: ctx.chat.id }, { lang: lang });
    const t = translations[lang];
    ctx.reply(t.start, Markup.keyboard([['BTC', 'ETH', 'SOL'], ['📊 ' + t.profile, '💎 ' + t.upgrade]]).resize());
});

bot.hears(['BTC', 'ETH', 'SOL'], async (ctx) => {
    const user = await User.findOne({ chatId: ctx.chat.id });
    const coin = ctx.message.text;
    const data = marketData[coin];
    const t = translations[user.lang || 'en'];
    if (!data) return ctx.reply("Scanning market, please wait...");
    ctx.replyWithMarkdown(`📊 *${coin} (${data.name})*\n💰 Price: $${data.price}\n📉 RSI: ${data.rsi}\n🚀 Action: *${t[data.action]}*`);
});

// ৫. স্টারস পেমেন্ট (Upgrade)
bot.hears(/Upgrade|আপগ্রেড|Обновить|ترقية|升级/, async (ctx) => {
    return ctx.replyWithInvoice({
        title: 'SignalEdge Pro',
        description: 'Get VIP Signals & Alerts',
        payload: 'pro_sub',
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: 'Pro', amount: 500 }]
    });
});

mongoose.connect(MONGO_URI).then(() => {
    console.log("🚀 Bot is Live!");
    bot.launch();
});
