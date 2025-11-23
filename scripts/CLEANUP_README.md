# Discord Server Cleanup Script

This script removes all Shield Finance channels, categories, and roles from your Discord server to give you a fresh start.

## What Gets Deleted

### Channels & Categories:
- INFO & RULES (and all channels inside)
- GENERAL (and all channels inside)
- SUPPORT & FEEDBACK (and all channels inside)
- DEVELOPERS & CONTRIBUTORS (and all channels inside)
- EXCLUSIVE — HOLDERS ONLY (and all channels inside)
- VOICE CHANNELS (and all channels inside)

### Roles (if enabled):
- Shield OG
- Shield Holder
- Staker
- Moderator
- Dev
- Verified Wallet
- Community Helper

## Usage

### Run the cleanup script:
```bash
node scripts/cleanup-discord-server.js
```

### Configure what to delete:

Open `scripts/cleanup-discord-server.js` and modify:

```javascript
const DELETE_ROLES = true;  // Set to false to keep roles
```

## After Cleanup

Once cleanup is complete, run the setup script to recreate everything fresh:

```bash
node scripts/create-shield-channels.js
```

This will create all channels, categories, and roles with no duplicates.

## Important Notes

- **Backup first**: Make sure you don't have important messages in these channels
- **Bot permissions**: The bot needs "Manage Channels" and "Manage Roles" permissions
- **Irreversible**: Deleted channels and messages cannot be recovered
- **Safe to run multiple times**: The script will only delete what exists

## Troubleshooting

### "Missing permissions" error
- Make sure your bot has Administrator permission or at least:
  - Manage Channels
  - Manage Roles

### Some channels/roles not deleted
- The script will skip items it can't delete and show an error
- Check the bot's role position (must be higher than roles it's trying to delete)
