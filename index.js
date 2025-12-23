
require('dotenv').config();
const { Telegraf } = require('telegraf');

// Accept several common environment variable names so hosting providers
// can supply credentials under different keys.
const BOT_TOKEN = (process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.TOKEN || '').trim() || null;
const _MOD_CHAT_RAW = (process.env.MOD_CHAT_ID || process.env.MOD_CHAT || process.env.TG_MOD_CHAT_ID || '').toString().trim();
const MOD_CHAT_ID = _MOD_CHAT_RAW ? Number(_MOD_CHAT_RAW) : null;

if (!BOT_TOKEN || !MOD_CHAT_ID) {
  console.error('Missing BOT_TOKEN (or TELEGRAM_BOT_TOKEN/TOKEN) or MOD_CHAT_ID (or MOD_CHAT/TG_MOD_CHAT_ID) in environment. See .env.example');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => ctx.reply('Hi — send me your JS question (text or media). Moderators will answer.'));

// Helper to extract user id from a message (text/caption) by pattern USER_ID:12345
function extractUserIdFromText(text) {
  if (!text) return null;
  const m = text.match(/USER_ID:(\d+)/);
  return m ? Number(m[1]) : null;
}

// When a normal user sends any message in private, forward to moderators and attach metadata
bot.on('message', async (ctx) => {
  try {
    if (ctx.chat.type !== 'private' || ctx.from.is_bot) return;

    // Forward original message to moderators so media is preserved
    const fwd = await ctx.telegram.forwardMessage(MOD_CHAT_ID, ctx.chat.id, ctx.message.message_id);

    // Send a small metadata message as a reply to the forwarded message so moderators can reply to it
    const userLabel = ctx.from.username ? `@${ctx.from.username}` : `${ctx.from.first_name || ''}`;
    await ctx.telegram.sendMessage(MOD_CHAT_ID, `USER_ID:${ctx.from.id} | ${userLabel}` , { reply_to_message_id: fwd.message_id });

    // Acknowledge to user
    await ctx.reply('Your question has been sent to moderators. You will get an answer here.');
  } catch (err) {
    console.error('Error forwarding to moderators:', err);
    ctx.reply('Failed to send your question — please try again later.');
  }
});

// Handle moderator replies in the mod chat
bot.on('message', async (ctx) => {
  try {
    if (ctx.chat.id !== MOD_CHAT_ID) return; // ignore other chats
    if (!ctx.message.reply_to_message) return; // moderator must reply to a forwarded message or metadata

    const replyTo = ctx.message.reply_to_message;

    // Attempt to extract user id from replied message's text or caption
    let targetUserId = extractUserIdFromText(replyTo.text) || extractUserIdFromText(replyTo.caption);

    // If not found, try to read forwarded_from
    if (!targetUserId && replyTo.forward_from && replyTo.forward_from.id) {
      targetUserId = replyTo.forward_from.id;
    }

    if (!targetUserId) {
      return ctx.reply('Could not determine target user id. Make sure you reply to the forwarded message or the metadata message.');
    }

    // If moderator sent text, prefix with a short header; otherwise copy the message content to the user
    const isText = !!ctx.message.text;

    try {
      if (isText) {
        await ctx.telegram.sendMessage(targetUserId, `Answer from moderator:\n\n${ctx.message.text}`);
      } else {
        // copyMessage preserves the content but sends as from the bot
        await ctx.telegram.copyMessage(targetUserId, ctx.chat.id, ctx.message.message_id);
      }

      await ctx.reply('Answer delivered to user.');
    } catch (deliverErr) {
      console.error('Failed to deliver moderator answer:', deliverErr);
      await ctx.reply('Failed to deliver the answer to the user. They may have blocked the bot or changed privacy settings.');
    }

  } catch (err) {
    console.error('Error handling moderator message:', err);
  }
});

async function startBot() {
  await bot.launch();
  console.log('Bot started');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

if (require.main === module) {
  startBot().catch(err => {
    console.error('Failed to start bot:', err);
    process.exit(1);
  });
}

module.exports = { bot, startBot };
