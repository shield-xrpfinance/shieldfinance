# Discord Channel Setup Bot

This script creates all the categories and channels for your Shield Finance Discord server.

## Prerequisites

Before running this script, you need to:

### 1. Create a Discord Bot
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it (e.g., "Shield Channel Setup")
3. Go to the "Bot" section and click "Add Bot"
4. Under "Token", click "Reset Token" and copy it (save it securely!)
5. Under "Privileged Gateway Intents", enable:
   - ✅ Server Members Intent (if you plan to use role verification)
   - ✅ Message Content Intent (if you plan to add moderation features later)

### 2. Get Required Permissions
Your bot needs these permissions:
- **Manage Channels** (required)
- **Administrator** (recommended for full access)

### 3. Invite Bot to Your Server
1. Go to "OAuth2" → "URL Generator" in the Discord Developer Portal
2. Select scopes:
   - ✅ `bot`
3. Select bot permissions:
   - ✅ `Administrator` (or at minimum `Manage Channels`)
4. Copy the generated URL and open it in your browser
5. Select your Shield Finance server and authorize

### 4. Get Your Server ID
1. In Discord, enable Developer Mode:
   - User Settings → Advanced → Developer Mode
2. Right-click your server icon → Copy Server ID

## Running the Script

### Set Environment Variables in Replit Secrets
1. In your Replit sidebar, click on "Secrets" (🔒 icon)
2. Add these two secrets:
   - Key: `DISCORD_BOT_TOKEN`, Value: (your bot token from step 1.4)
   - Key: `DISCORD_GUILD_ID`, Value: (your server ID from step 4.2)

### Run the Script
In the Replit Shell, run:
```bash
node scripts/create-shield-channels.js
```

The script will:
1. Connect to Discord
2. Verify it can access your server
3. Create all categories and channels:
   - INFO & RULES (4 channels)
   - GENERAL (5 channels)
   - SUPPORT & FEEDBACK (3 channels)
   - DEVELOPERS & CONTRIBUTORS (3 channels)
   - EXCLUSIVE — HOLDERS ONLY (3 channels)
   - VOICE CHANNELS (4 channels)
4. Exit when complete

## What Gets Created

### Categories & Channels:
- **INFO & RULES**: start-here, rules, announcements, roadmap
- **GENERAL**: lounge, xrpl-vaults, yield-tips, off-topic, memes
- **SUPPORT & FEEDBACK**: help-desk, ideas-board, bug-reports
- **DEVELOPERS & CONTRIBUTORS**: dev-chat, bounty-board, github-updates
- **EXCLUSIVE — HOLDERS ONLY**: holder-lounge, alpha-vaults, revenue-share
- **VOICE CHANNELS**: General Voice, Vault Strategy Room, AMA Stage, Music & Chill

## Troubleshooting

### "Missing required environment variables"
- Make sure you've added both `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` to Replit Secrets

### "Guild not found"
- Verify your `DISCORD_GUILD_ID` is correct
- Make sure the bot has been invited to your server

### "Bot lacks permissions" (Error code 50013)
- Make sure your bot has "Manage Channels" or "Administrator" permissions
- Re-invite the bot with proper permissions using the OAuth2 URL

### Channels Already Exist
- The script will fail if channels with the same names already exist
- Either delete conflicting channels first, or modify the script to use different names

## Notes

- This is a **one-time setup script** that runs and exits
- It does **not** need to run continuously
- Once channels are created, you can remove the bot from your server if desired
- To recreate channels, you'll need to delete the existing ones first

## Next Steps

After running this script, you may want to:
1. Set up permissions for specific roles (e.g., holder-only channels)
2. Pin important messages in start-here and rules
3. Configure webhooks for github-updates
4. Set up Discord webhook alerts for your Shield Finance monitoring system
