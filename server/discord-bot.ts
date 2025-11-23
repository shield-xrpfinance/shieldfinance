// Shield Finance Discord Bot
// Minimal bot for server management and member greeting
import {
  Client,
  GatewayIntentBits,
} from 'discord.js';

export async function startDiscordBot() {
  const TOKEN = process.env.DISCORD_BOT_TOKEN;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;

  if (!TOKEN || !GUILD_ID) {
    console.log('⚠️  Discord bot not configured (missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID)');
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.once('ready', async () => {
    console.log(`✅ Discord Bot online as ${client.user?.tag}`);
    console.log(`🔐 Monitoring guild: ${GUILD_ID}`);
  });

  // Welcome new members
  client.on('guildMemberAdd', async (member) => {
    try {
      console.log(`👋 ${member.user.tag} joined the server`);
      
      // Auto-assign 'Verified Wallet' role to new members
      const role = member.guild.roles.cache.find(r => r.name === 'Verified Wallet');
      if (role) {
        await member.roles.add(role);
        console.log(`✅ Assigned 'Verified Wallet' role to ${member.user.tag}`);
      }
    } catch (error) {
      console.error('Error welcoming member:', error);
    }
  });

  client.on('error', (error) => {
    console.error('Discord client error:', error);
  });

  try {
    await client.login(TOKEN);
    console.log('✅ Discord bot connected');
    return client;
  } catch (error) {
    console.error('❌ Failed to login Discord bot:', error);
    throw error;
  }
}
