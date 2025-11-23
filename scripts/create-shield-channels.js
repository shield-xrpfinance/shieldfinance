// Shield Finance — UNIVERSAL WALLET VERIFICATION (Xaman + WalletConnect)
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
} from 'discord.js';
import { ethers } from 'ethers';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const pending = new Map(); // userId → verification data

// Roles to create
const ROLES = [
  { name: 'Shield OG', color: '#FFD700' },
  { name: 'Shield Holder', color: '#00FFAA' },
  { name: 'Staker', color: '#FF6B9D' },
  { name: 'Moderator', color: '#FF0000' },
  { name: 'Dev', color: '#0099FF' },
  { name: 'Verified Wallet', color: '#00FF00' },
];

// Channels structure
const CHANNELS = {
  'INFO & RULES': [
    'start-here',
    'announcements',
    'rules',
    'roadmap',
  ],
  'GENERAL': [
    'lounge',
    'xrpl-vaults',
    'yield-tips',
    'off-topic',
    'memes',
    'vault-stats',
  ],
  'SUPPORT & FEEDBACK': [
    'help-desk',
    'bug-reports',
    'ideas-board',
    'support',
  ],
  'DEVELOPERS & CONTRIBUTORS': [
    'dev-chat',
    'github-updates',
    'bounty-board',
  ],
  'EXCLUSIVE — HOLDERS ONLY': [
    'holder-lounge',
    'alpha-vaults',
    'revenue-share',
  ],
  'VOICE CHANNELS': {
    type: 'voice',
    channels: [
      'General Voice',
      'AMA - General Discussion',
      'Vault Strategy Room',
      'Music & Chill',
    ],
  },
};

client.once('ready', async () => {
  console.log(`✅ Shield Bot online as ${client.user.tag}\n`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('❌ Guild not found');
    process.exit(1);
  }

  try {
    // 1. Create roles
    console.log('👥 Creating roles...');
    for (const roleConfig of ROLES) {
      const existingRole = guild.roles.cache.find(r => r.name === roleConfig.name);
      if (existingRole) {
        console.log(`✓ Role already exists: ${roleConfig.name}`);
        continue;
      }
      await guild.roles.create({
        name: roleConfig.name,
        color: roleConfig.color,
        reason: 'Shield Finance bot setup',
      });
      console.log(`✓ Created role: ${roleConfig.name}`);
    }

    // 2. Create categories and channels
    console.log('\n📋 Creating channels...');
    for (const [categoryName, channelConfig] of Object.entries(CHANNELS)) {
      // Check if category already exists
      let category = guild.channels.cache.find(
        c => c.type === 4 && c.name === categoryName
      );

      if (!category) {
        category = await guild.channels.create({
          name: categoryName,
          type: ChannelType.GuildCategory,
        });
        console.log(`✓ Created category: ${categoryName}`);
      } else {
        console.log(`✓ Category already exists: ${categoryName}`);
      }

      // Create channels in this category
      const isVoice = channelConfig.type === 'voice';
      const channelNames = isVoice ? channelConfig.channels : channelConfig;

      for (const channelName of channelNames) {
        const existingChannel = guild.channels.cache.find(
          c => c.name === channelName && c.parentId === category.id
        );

        if (existingChannel) {
          console.log(`  ✓ Channel already exists: ${channelName}`);
          continue;
        }

        await guild.channels.create({
          name: channelName,
          type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
          parent: category.id,
        });
        console.log(`  ✓ Created channel: ${channelName}`);
      }
    }

    // 3. Set up slash commands
    console.log('\n🔧 Setting up slash commands...');
    await guild.commands.set([
      new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify with any wallet (Xaman or WalletConnect)'),
    ]);
    console.log('✓ Slash commands registered');

    // 4. Post welcome message with wallet verification button
    console.log('\n📨 Setting up welcome message with wallet verification...');
    const welcome = guild.channels.cache.find(c => c.name === 'start-here');
    if (welcome) {
      await welcome.bulkDelete(20).catch(() => {});
      await welcome.send({
        content: '@everyone',
        embeds: [
          new EmbedBuilder()
            .setColor('#00FFAA')
            .setTitle('Verify Your Wallet — Works with Xaman & WalletConnect')
            .setDescription('Click the button below or type `/verify` to verify your wallet and unlock exclusive roles and channels!\n\n🛡️ **Shield Finance** supports both XRPL (via Xaman) and EVM wallets (via WalletConnect).'),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('verify_btn')
              .setLabel('Verify Wallet')
              .setStyle(ButtonStyle.Success)
          ),
        ],
      });
      console.log('✓ Welcome message posted with verification button');
    }

    console.log('\n🎉 Shield Finance bot fully deployed — all upgrades live!');
    console.log('ℹ️  Bot is now listening for button interactions and wallet verification...\n');

  } catch (error) {
    console.error('❌ Error during setup:', error);
    process.exit(1);
  }
});

// ==============================
// WALLET VERIFICATION HANDLERS
// ==============================

// Main entry point: User clicks button or uses /verify command
client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand() && !i.isButton()) return;
  if (i.commandName !== 'verify' && i.customId !== 'verify_btn') return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('xaman_verify')
      .setLabel('Xaman / Classic Wallet')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('wc_verify')
      .setLabel('WalletConnect (MetaMask, Trust, etc.)')
      .setStyle(ButtonStyle.Secondary)
  );

  await i.reply({
    content: 'Choose your wallet type:',
    components: [row],
    ephemeral: true,
  });
});

// ——— XRPL WALLET (Xaman) ———
client.on('interactionCreate', async (i) => {
  if (i.customId === 'xaman_verify') {
    const modal = new ModalBuilder()
      .setCustomId('xaman_modal')
      .setTitle('XRPL Address');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('addr')
          .setLabel('r-address (starts with r)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    await i.showModal(modal);
  }

  if (i.customId === 'xaman_modal') {
    const address = i.fields.getTextInputValue('addr');
    const challenge = `Shield Finance verification ${Date.now()}-${i.user.id}`;
    pending.set(i.user.id, { type: 'xaman', address, challenge });

    const modal2 = new ModalBuilder()
      .setCustomId('xaman_sig')
      .setTitle('Sign & Verify');
    modal2.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('sig')
          .setLabel(`Sign this: ${challenge.substring(0, 50)}...`)
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(`Sign in Xaman:\n${challenge}`)
      )
    );
    await i.showModal(modal2);
  }

  if (i.customId === 'xaman_sig') {
    const sig = i.fields.getTextInputValue('sig');
    const data = pending.get(i.user.id);

    if (!data) {
      await i.reply({ content: 'Verification expired. Please start over.', ephemeral: true });
      return;
    }

    try {
      // Verify signature via public XRPL node
      const response = await fetch('https://s1.ripple.com:51234', {
        method: 'POST',
        body: JSON.stringify({
          method: 'verify',
          params: [
            {
              message: data.challenge,
              signature: sig,
              address: data.address,
            },
          ],
        }),
      });

      const res = await response.json();

      if (res.result?.verified) {
        await giveRoles(i.member);
        await i.reply({
          content: `✅ **Wallet Verified!**\n\nYour address: \`${data.address}\`\nYou now have access to exclusive channels and roles!`,
          ephemeral: true,
        });
        console.log(`✓ ${i.user.tag} verified XRPL wallet: ${data.address}`);
      } else {
        await i.reply({
          content: '❌ Invalid signature or verification failed. Please try again.',
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('Xaman verification error:', error);
      await i.reply({
        content: '❌ Verification error. Please try again.',
        ephemeral: true,
      });
    }
    pending.delete(i.user.id);
  }
});

// ——— WALLETCONNECT (EVM sidechain) ———
client.on('interactionCreate', async (i) => {
  if (i.customId === 'wc_verify') {
    const nonce = Math.floor(Math.random() * 1e9);
    pending.set(i.user.id, { type: 'wc', nonce });

    const domain = {
      name: 'Shield Finance',
      version: '1',
      chainId: 1440002,
    }; // XRPL EVM sidechain
    const types = {
      Verify: [{ name: 'nonce', type: 'uint256' }],
    };
    const message = { nonce };

    const typedData = JSON.stringify(
      { domain, types, message, primaryType: 'Verify' },
      null,
      2
    );

    await i.reply({
      content: `**Connect with WalletConnect & sign this message:**\n\`\`\`json\n${typedData}\n\`\`\`\n\nUse your wallet to sign this typed data, then paste the full JSON response below.`,
      ephemeral: true,
    });

    const modal = new ModalBuilder()
      .setCustomId('wc_sig')
      .setTitle('Paste Signed Message');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('signed')
          .setLabel('Full JSON output from wallet')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    await i.showModal(modal);
  }

  if (i.customId === 'wc_sig') {
    const input = i.fields.getTextInputValue('signed');
    const data = pending.get(i.user.id);

    if (!data || data.type !== 'wc') {
      await i.reply({
        content: 'Verification expired. Please start over.',
        ephemeral: true,
      });
      return;
    }

    try {
      const parsed = JSON.parse(input);
      const recovered = ethers.verifyTypedData(
        parsed.domain,
        parsed.types,
        parsed.message,
        parsed.signature
      );

      if (parsed.message.nonce === data.nonce) {
        await giveRoles(i.member);
        await i.reply({
          content: `✅ **Wallet Verified!**\n\nYour wallet: \`${recovered}\`\nYou now have access to exclusive channels and roles!`,
          ephemeral: true,
        });
        console.log(`✓ ${i.user.tag} verified EVM wallet: ${recovered}`);
      } else {
        await i.reply({
          content: '❌ Invalid signature. Nonce mismatch.',
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('WalletConnect verification error:', error);
      await i.reply({
        content: '❌ Invalid signature or JSON format. Please try again.',
        ephemeral: true,
      });
    }
    pending.delete(i.user.id);
  }
});

// Helper: Give verified roles
async function giveRoles(member) {
  try {
    const roles = [
      'Shield Holder',
      'Verified Wallet',
      'Staker',
    ]
      .map((name) => member.guild.roles.cache.find((r) => r.name === name))
      .filter(Boolean);

    await member.roles.add(roles);
    console.log(`✓ Roles assigned to ${member.user.tag}`);
  } catch (error) {
    console.error(`Error assigning roles to ${member.user.tag}:`, error);
  }
}

client.login(TOKEN);
