// create-shield-channels.js
import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !GUILD_ID) {
  console.error('❌ Missing required environment variables:');
  if (!TOKEN) console.error('   - DISCORD_BOT_TOKEN');
  if (!GUILD_ID) console.error('   - DISCORD_GUILD_ID');
  console.error('\nPlease set these in your Replit Secrets.');
  process.exit(1);
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('❌ Guild not found — check DISCORD_GUILD_ID');
    process.exit(1);
  }

  console.log(`🔧 Setting up channels for: ${guild.name}`);

  // Helper to create category + channels
  const createCategory = async (name, channels) => {
    const category = await guild.channels.create({
      name,
      type: 4, // ChannelType.GuildCategory
    });

    for (const ch of channels) {
      await guild.channels.create({
        name: ch.name,
        type: ch.type || 0, // 0 = text, 2 = voice
        topic: ch.topic || null,
        parent: category,
        permissionOverwrites: ch.overwrites || [],
      });
    }
    console.log(`✓ Created category: ${name}`);
  };

  try {
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║   SHIELD FINANCE DISCORD SETUP       ║');
    console.log('╚══════════════════════════════════════╝\n');

    await createCategory('INFO & RULES', [
      { name: 'start-here', topic: 'Read this first — Verify wallet → get roles' },
      { name: 'rules', topic: 'Community guidelines (zero tolerance for scams)' },
      { name: 'announcements', topic: 'Official updates only — @everyone pings here' },
      { name: 'roadmap', topic: 'Current milestones & upcoming vaults' },
    ]);

    await createCategory('GENERAL', [
      { name: 'lounge', topic: 'Hang out & talk XRP/DeFi' },
      { name: 'xrpl-vaults', topic: 'Discuss Shield vaults, strategies & APY' },
      { name: 'yield-tips', topic: 'Share compounding tricks & analytics' },
      { name: 'off-topic', topic: 'Anything non-crypto' },
      { name: 'memes', topic: 'Best XRP & Shield memes win SHIELD tokens' },
    ]);

    await createCategory('SUPPORT & FEEDBACK', [
      { name: 'help-desk', topic: 'Ask questions — team & helpers will assist' },
      { name: 'ideas-board', topic: 'Propose features → polls → Snapshot voting' },
      { name: 'bug-reports', topic: 'Found a vault or dashboard issue? Post here' },
    ]);

    await createCategory('DEVELOPERS & CONTRIBUTORS', [
      { name: 'dev-chat', topic: 'Solidity, Hardhat, XRPL EVM sidechain talk' },
      { name: 'bounty-board', topic: 'Active tasks — earn SHIELD tokens' },
      { name: 'github-updates', topic: 'Auto-posted commits from shield-xrpfinance repo' },
    ]);

    await createCategory('EXCLUSIVE — HOLDERS ONLY', [
      { name: 'holder-lounge', topic: 'Verified vault holders & SHIELD stakers only' },
      { name: 'alpha-vaults', topic: 'Early access strategies & private testnet links' },
      { name: 'revenue-share', topic: 'Real-time RevenueRouter & burn analytics' },
    ]);

    await createCategory('VOICE CHANNELS', [
      { name: 'General Voice', type: 2 },
      { name: 'Vault Strategy Room', type: 2 },
      { name: 'AMA - General Discussion', type: 2 },
      { name: 'Music & Chill', type: 2 },
    ]);

    console.log('\n✅ All channels created successfully!');
    console.log('🎉 Your Shield Finance Discord server is ready!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.code === 50013) {
      console.error('\n⚠️  Bot lacks permissions. Make sure your bot has:');
      console.error('   - Manage Channels');
      console.error('   - Administrator (recommended for full access)');
    }
  } finally {
    client.destroy();
  }
});

client.login(TOKEN);
