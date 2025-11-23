// create-shield-channels.js
import { Client, GatewayIntentBits, ChannelType, EmbedBuilder } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !GUILD_ID) {
  console.error('❌ Missing required environment variables:');
  if (!TOKEN) console.error('   - DISCORD_BOT_TOKEN');
  if (!GUILD_ID) console.error('   - DISCORD_GUILD_ID');
  process.exit(1);
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('❌ Guild not found');
    process.exit(1);
  }

  console.log(`🔧 Setting up Shield Finance server: ${guild.name}\n`);

  try {
    // === 1. CREATE CHANNELS ===
    console.log('📋 Creating channels...');
    const createCategory = async (name, channels) => {
      const category = await guild.channels.create({ 
        name, 
        type: ChannelType.GuildCategory 
      });
      for (const ch of channels) {
        await guild.channels.create({
          name: ch.name,
          type: ch.type ?? ChannelType.GuildText,
          topic: ch.topic || null,
          parent: category,
          permissionOverwrites: ch.overwrites || [],
        });
      }
      console.log(`✓ Created category: ${name}`);
      return category;
    };

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
      { name: 'General Voice', type: ChannelType.GuildVoice },
      { name: 'Vault Strategy Room', type: ChannelType.GuildVoice },
      { name: 'AMA - General Discussion', type: ChannelType.GuildVoice },
      { name: 'Music & Chill', type: ChannelType.GuildVoice },
    ]);

    // === 2. CREATE ROLES ===
    console.log('\n👥 Creating roles...');
    const roles = [
      { name: 'Shield Holder', color: '#00FFAA', hoist: true },
      { name: 'Staker', color: '#0099FF', hoist: true },
      { name: 'Dev', color: '#FF0066' },
      { name: 'Moderator', color: '#FFAA00', permissions: ['ManageMessages', 'KickMembers', 'BanMembers'] },
      { name: 'Community Helper', color: '#AA66FF' },
    ];

    for (const roleData of roles) {
      try {
        await guild.roles.create({
          name: roleData.name,
          color: roleData.color,
          hoist: roleData.hoist || false,
          permissions: roleData.permissions || [],
        });
        console.log(`✓ Created role: ${roleData.name}`);
      } catch (error) {
        if (error.code === 50013 || error.message.includes('already exists')) {
          console.log(`✓ Role already exists: ${roleData.name}`);
        } else {
          throw error;
        }
      }
    }

    // === 3. SET UP WELCOME MESSAGE ===
    console.log('\n📨 Setting up welcome message...');
    const welcomeChannel = guild.channels.cache.find(c => c.name === 'start-here');
    if (welcomeChannel && welcomeChannel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Welcome to Shield Finance')
        .setDescription('Institutional-grade XRP liquid staking & multi-asset vaults on XRPL')
        .setColor('#00FFAA')
        .addFields(
          { name: '📖 Step 1', value: 'Read <#rules>' },
          { name: '✅ Step 2', value: 'React below to verify wallet & unlock channels' },
          { name: '🔗 Useful Links', value: '[Website](https://shield.finance) • [Docs](https://docs.shield.finance) • [GitHub](https://github.com/shield-xrpfinance/shieldfinance)' }
        )
        .setThumbnail(guild.iconURL())
        .setTimestamp();

      await welcomeChannel.send({ embeds: [embed] });
      await welcomeChannel.send('React with 🛡️ to get the **Shield Holder** role');
      console.log('✓ Welcome message posted');
    }

    // === 4. AUTO-ROLE ON REACTION ===
    console.log('\n⚙️  Setting up auto-role reactions...');
    client.on('messageReactionAdd', async (reaction, user) => {
      try {
        if (user.bot) return;
        if (reaction.message.channel.name !== 'start-here') return;

        // Fetch full member object
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        const shieldHolderRole = guild.roles.cache.find(r => r.name === 'Shield Holder');

        if (shieldHolderRole && (reaction.emoji.name === '🛡️' || reaction.emoji.toString() === '🛡️')) {
          await member.roles.add(shieldHolderRole);
          console.log(`✓ Added Shield Holder role to ${user.username}`);
        }
      } catch (error) {
        console.error('Error handling reaction:', error);
      }
    });
    console.log('✓ Auto-role listener active');

    console.log('\n🎉 All done! Channels + roles + welcome system ready');
    console.log('ℹ️  Bot will stay online to handle role reactions...\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    client.destroy();
    process.exit(1);
  }
});

client.login(TOKEN);
