# Telegram Moderation Bot

Simple Node.js bot where users send questions (text/media) and moderators answer in a moderator chat; answers are forwarded back to the user.

Setup

1. Copy `.env.example` to `.env` and fill values:

   - `BOT_TOKEN` — token from BotFather
   - `MOD_CHAT_ID` — numeric chat id for moderators (group/channel id)

2. Install and run:

```bash
npm install
npm start
```

How it works

- Users send messages to the bot in private.
- The bot forwards the original message to `MOD_CHAT_ID` and sends a small metadata message containing `USER_ID:<id>` as a reply to the forwarded message.
- Moderators reply to the forwarded message (or the metadata message). When the bot detects a reply in the mod chat, it extracts the `USER_ID` and sends the moderator's reply back to that user. For non-text replies the bot copies the message content to the user.

Notes

- If the bot fails to deliver a moderator answer, the moderator is notified.
- For production use consider persistent storage and enhanced parsing, permissions checks, and better formatting/escaping for messages.
