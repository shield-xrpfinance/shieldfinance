# Discord Channel Setup Bot - Complete Guide

This script creates all the categories and channels for your Shield Finance Discord server.

## ✅ Current Status

- ✅ Script created and ready
- ✅ discord.js package installed
- ✅ Environment variables configured (DISCORD_BOT_TOKEN, DISCORD_GUILD_ID)
- ⏳ **Next Step: Invite bot to your Discord server**

## 🤖 Bot Information

Your bot successfully logged in as: **Shield Finance Bot#4560**

However, it needs to be invited to your server with the proper permissions.

---

## 📋 Step-by-Step Setup

### Step 1: Create Discord Bot Application (if not done)

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Find your existing application or create a new one
3. Go to the **Bot** section
4. Make sure you have the bot token saved (already configured in Replit Secrets ✅)

### Step 2: Configure Bot Permissions

In the Discord Developer Portal:

1. Go to **Bot** section
2. Scroll down to **Privileged Gateway Intents**
3. Enable these (optional but recommended for future features):
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**

### Step 3: Generate Invite URL

1. In Discord Developer Portal, go to **OAuth2** → **URL Generator**
2. Select **Scopes**:
   - ✅ `bot`
3. Select **Bot Permissions**:
   - ✅ `Administrator` (easiest - grants all permissions)
   
   OR select individual permissions:
   - ✅ `Manage Channels`
   - ✅ `Manage Roles` (if you plan to set channel permissions)
   - ✅ `View Channels`
   - ✅ `Send Messages`

4. Copy the generated URL at the bottom

### Step 4: Invite Bot to Server

1. Paste the invite URL into your browser
2. Select your **Shield Finance** server from the dropdown
3. Click **Authorize**
4. Complete the CAPTCHA

### Step 5: Verify Guild ID (Important!)

Make sure your `DISCORD_GUILD_ID` is correct:

1. In Discord, enable **Developer Mode**:
   - User Settings → App Settings → Advanced → **Developer Mode** (toggle ON)
2. Right-click on your **Shield Finance** server icon
3. Click **Copy Server ID**
4. Verify this matches the `DISCORD_GUILD_ID` in your Replit Secrets

### Step 6: Run the Script

Once the bot is invited, run:

```bash
node scripts/create-shield-channels.js
```

---

## 🎯 What Gets Created

The script creates **6 categories** with **22 total channels**:

### 📌 INFO & RULES (4 channels)
- `start-here` - Read this first — Verify wallet → get roles
- `rules` - Community guidelines (zero tolerance for scams)
- `announcements` - Official updates only — @everyone pings here
- `roadmap` - Current milestones & upcoming vaults

### 💬 GENERAL (5 channels)
- `lounge` - Hang out & talk XRP/DeFi
- `xrpl-vaults` - Discuss Shield vaults, strategies & APY
- `yield-tips` - Share compounding tricks & analytics
- `off-topic` - Anything non-crypto
- `memes` - Best XRP & Shield memes win SHIELD tokens

### 🆘 SUPPORT & FEEDBACK (3 channels)
- `help-desk` - Ask questions — team & helpers will assist
- `ideas-board` - Propose features → polls → Snapshot voting
- `bug-reports` - Found a vault or dashboard issue? Post here

### 👨‍💻 DEVELOPERS & CONTRIBUTORS (3 channels)
- `dev-chat` - Solidity, Hardhat, XRPL EVM sidechain talk
- `bounty-board` - Active tasks — earn SHIELD tokens
- `github-updates` - Auto-posted commits from shield-xrpfinance repo

### 🔒 EXCLUSIVE — HOLDERS ONLY (3 channels)
- `holder-lounge` - Verified vault holders & SHIELD stakers only
- `alpha-vaults` - Early access strategies & private testnet links
- `revenue-share` - Real-time RevenueRouter & burn analytics

### 🎤 VOICE CHANNELS (4 channels)
- `General Voice` (Voice)
- `Vault Strategy Room` (Voice)
- `AMA Stage` (Stage Channel)
- `Music & Chill` (Voice)

---

## 🔧 Troubleshooting

### ❌ "Guild not found — check DISCORD_GUILD_ID"

**Problem**: The bot can't find your server

**Solutions**:
1. Make sure you've **invited the bot** to your server (Step 4 above)
2. Verify your `DISCORD_GUILD_ID` is correct (Step 5 above)
3. Make sure the bot appears in your server's member list

### ❌ "Missing required environment variables"

**Problem**: Secrets not configured

**Solution**: 
- Add both `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` to Replit Secrets (already done ✅)

### ❌ Error code 50013 - "Bot lacks permissions"

**Problem**: Bot doesn't have enough permissions

**Solutions**:
1. Re-invite the bot with **Administrator** permission (recommended)
2. OR make sure bot has at least **Manage Channels** permission
3. In your Discord server, check Server Settings → Roles → verify bot role has needed permissions

### ❌ "Cannot create channel: Maximum number of channels reached"

**Problem**: Discord servers have a 500 channel limit

**Solution**: Delete unused channels first

### ❌ Channels already exist with same names

**Problem**: Script creates duplicate names

**Solution**: Either:
- Delete existing channels first
- Modify the channel names in the script

---

## 📝 Notes

- This is a **one-time setup script** - it runs once and exits
- It does **not** need to stay running
- After channels are created, you can customize permissions for each channel
- You can remove the bot after setup if you don't need it for other purposes

---

## 🚀 Next Steps After Running

1. **Set up channel permissions** for exclusive channels (holder-lounge, alpha-vaults, etc.)
2. **Pin welcome messages** in start-here and rules channels
3. **Configure webhooks** for github-updates (optional)
4. **Set up Discord alerts** from your Shield Finance monitoring system (webhook already supported in AlertingService.ts)

---

## 💡 Quick Reference

**Run the script:**
```bash
node scripts/create-shield-channels.js
```

**Check if bot is online:**
- Look for "Shield Finance Bot#4560" in your server member list
- The bot should have a green "Online" status

**Update secrets if needed:**
1. Go to Replit Secrets (🔒 icon in sidebar)
2. Edit `DISCORD_BOT_TOKEN` or `DISCORD_GUILD_ID`
3. No restart needed - script reads them at runtime
