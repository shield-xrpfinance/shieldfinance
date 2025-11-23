// Discord Server Cleanup Script
import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !GUILD_ID) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Configure what to delete
const DELETE_ROLES = true; // Set to false if you want to keep roles

const CATEGORIES_TO_DELETE = [
  'INFO & RULES',
  'GENERAL',
  'SUPPORT & FEEDBACK',
  'DEVELOPERS & CONTRIBUTORS',
  'EXCLUSIVE — HOLDERS ONLY',
  'VOICE CHANNELS',
];

const ROLES_TO_DELETE = [
  'Shield OG',
  'Shield Holder',
  'Staker',
  'Moderator',
  'Dev',
  'Verified Wallet',
  'Community Helper', // from earlier version
];

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('❌ Guild not found');
    process.exit(1);
  }

  console.log(`\n🧹 Starting cleanup for: ${guild.name}\n`);

  try {
    // Fetch all channels and roles
    await guild.channels.fetch();
    await guild.roles.fetch();

    let deletedChannels = 0;
    let deletedCategories = 0;
    let deletedRoles = 0;

    // 1. Delete all categories and their channels
    console.log('📋 Deleting channels and categories...');
    for (const categoryName of CATEGORIES_TO_DELETE) {
      const categories = guild.channels.cache.filter(
        c => c.type === 4 && c.name === categoryName
      );

      for (const [_, category] of categories) {
        console.log(`\n  🗂️  Found category: ${category.name}`);
        
        // Delete all channels in this category
        const channelsInCategory = guild.channels.cache.filter(
          c => c.parentId === category.id
        );

        for (const [_, channel] of channelsInCategory) {
          try {
            await channel.delete();
            console.log(`    ✓ Deleted channel: ${channel.name}`);
            deletedChannels++;
          } catch (error) {
            console.error(`    ✗ Failed to delete channel ${channel.name}:`, error.message);
          }
        }

        // Delete the category itself
        try {
          await category.delete();
          console.log(`  ✓ Deleted category: ${category.name}`);
          deletedCategories++;
        } catch (error) {
          console.error(`  ✗ Failed to delete category ${category.name}:`, error.message);
        }
      }
    }

    // 2. Delete roles (if enabled)
    if (DELETE_ROLES) {
      console.log('\n👥 Deleting roles...');
      for (const roleName of ROLES_TO_DELETE) {
        const roles = guild.roles.cache.filter(r => r.name === roleName);
        
        for (const [_, role] of roles) {
          try {
            await role.delete();
            console.log(`  ✓ Deleted role: ${role.name}`);
            deletedRoles++;
          } catch (error) {
            console.error(`  ✗ Failed to delete role ${role.name}:`, error.message);
          }
        }
      }
    } else {
      console.log('\n👥 Skipping role deletion (DELETE_ROLES = false)');
    }

    // Summary
    console.log('\n╔════════════════════════════════╗');
    console.log('║      CLEANUP SUMMARY           ║');
    console.log('╚════════════════════════════════╝');
    console.log(`✓ Deleted ${deletedChannels} channels`);
    console.log(`✓ Deleted ${deletedCategories} categories`);
    if (DELETE_ROLES) {
      console.log(`✓ Deleted ${deletedRoles} roles`);
    }
    console.log('\n🎉 Server cleanup complete!');
    console.log('ℹ️  You can now run the setup script to recreate everything fresh:\n');
    console.log('   node scripts/create-shield-channels.js\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(TOKEN);
