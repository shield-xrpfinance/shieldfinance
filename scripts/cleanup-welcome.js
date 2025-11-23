// One-time cleanup: Remove old verification message and post simple welcome
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

client.once('ready', async () => {
  console.log(`✅ Cleanup bot online as ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('❌ Guild not found');
    process.exit(1);
  }

  try {
    // Find #start-here channel
    const startHere = guild.channels.cache.find(c => c.name === 'start-here');
    if (!startHere) {
      console.error('❌ #start-here channel not found');
      process.exit(1);
    }

    console.log('🧹 Cleaning up old messages in #start-here...');
    
    // Delete recent messages (includes the old verify button message)
    await startHere.bulkDelete(20).catch(() => {});
    console.log('✅ Old messages deleted');

    // Post new simple welcome message
    await startHere.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FFAA')
          .setTitle('🛡️ Welcome to Shield Finance')
          .setDescription(
            '**Your gateway to XRP liquid staking on Flare Network**\n\n' +
            '🔹 Stake your XRP and earn passive yield\n' +
            '🔹 Access exclusive holder channels\n' +
            '🔹 Join our community of DeFi enthusiasts\n\n' +
            'Get started by exploring the channels below!'
          )
          .setFooter({ text: 'Shield Finance • Building the future of XRP DeFi' })
      ]
    });
    console.log('✅ Posted new welcome message');

    console.log('\n🎉 Cleanup complete! Discord server updated.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
});

client.login(TOKEN);
