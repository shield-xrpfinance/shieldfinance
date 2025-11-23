// Shield Finance Discord Bot - Persistent Server
// Handles universal wallet verification (Xaman + WalletConnect)
import {
  Client,
  GatewayIntentBits,
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

// ==============================
// BOT READY EVENT
// ==============================
client.once('ready', async () => {
  console.log(`✅ Shield Finance Bot online as ${client.user.tag}`);
  console.log(`🔐 Monitoring guild: ${GUILD_ID}`);
  console.log(`📡 Listening for wallet verification requests...\n`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('❌ Guild not found');
    process.exit(1);
  }

  // Register slash commands
  try {
    await guild.commands.set([
      new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify with any wallet (Xaman or WalletConnect)'),
    ]);
    console.log('✅ Slash commands registered\n');
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }
});

// ==============================
// WALLET VERIFICATION HANDLERS
// ==============================

// Main entry point: User clicks button or uses /verify command
client.on('interactionCreate', async (i) => {
  try {
    if (!i.isChatInputCommand() && !i.isButton()) return;
    if (i.commandName !== 'verify' && i.customId !== 'verify_btn') return;

    console.log(`🔔 ${i.user.tag} initiated wallet verification`);

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
      flags: 64, // Ephemeral flag
    });
  } catch (error) {
    console.error('Error in verify handler:', error);
  }
});

// ——— XRPL WALLET (Xaman) ———
client.on('interactionCreate', async (i) => {
  try {
    if (!i.isButton()) return;

    if (i.customId === 'xaman_verify') {
      console.log(`🔐 ${i.user.tag} chose Xaman wallet verification`);

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
  } catch (error) {
    console.error('Error in xaman_verify handler:', error);
  }
});

client.on('interactionCreate', async (i) => {
  try {
    if (!i.isModalSubmit()) return;

    if (i.customId === 'xaman_modal') {
      const address = i.fields.getTextInputValue('addr');
      const challenge = `Shield Finance verification ${Date.now()}-${i.user.id}`;
      pending.set(i.user.id, { type: 'xaman', address, challenge });

      console.log(`📝 ${i.user.tag} entered XRPL address: ${address}`);

      const modal2 = new ModalBuilder()
        .setCustomId('xaman_sig')
        .setTitle('Sign & Verify');
      modal2.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('sig')
            .setLabel('Paste signature from Xaman')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder(`First, sign this in Xaman:\n${challenge}`)
        )
      );
      await i.showModal(modal2);
    }

    if (i.customId === 'xaman_sig') {
      const sig = i.fields.getTextInputValue('sig');
      const data = pending.get(i.user.id);

      if (!data) {
        await i.reply({ 
          content: '❌ Verification expired. Please start over with `/verify`', 
          flags: 64 
        });
        return;
      }

      console.log(`🔍 Verifying XRPL signature for ${i.user.tag}...`);

      try {
        // Verify signature via public XRPL node
        const response = await fetch('https://s1.ripple.com:51234', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            content: `✅ **Wallet Verified!**\n\nYour XRPL address: \`${data.address}\`\nYou now have access to exclusive channels and roles!`,
            flags: 64,
          });
          console.log(`✅ ${i.user.tag} successfully verified XRPL wallet: ${data.address}`);
        } else {
          await i.reply({
            content: '❌ Invalid signature or verification failed. Please try again with `/verify`',
            flags: 64,
          });
          console.log(`❌ ${i.user.tag} failed XRPL verification`);
        }
      } catch (error) {
        console.error('Xaman verification error:', error);
        await i.reply({
          content: '❌ Verification error. Please try again with `/verify`',
          flags: 64,
        });
      }
      pending.delete(i.user.id);
    }
  } catch (error) {
    console.error('Error in xaman modal handler:', error);
  }
});

// ——— WALLETCONNECT (EVM sidechain) ———
client.on('interactionCreate', async (i) => {
  try {
    if (!i.isButton()) return;

    if (i.customId === 'wc_verify') {
      console.log(`🔐 ${i.user.tag} chose WalletConnect verification`);

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
            .setPlaceholder(`Sign this typed data in your wallet:\n${typedData.substring(0, 100)}...`)
        )
      );
      await i.showModal(modal);
    }
  } catch (error) {
    console.error('Error in wc_verify handler:', error);
  }
});

client.on('interactionCreate', async (i) => {
  try {
    if (!i.isModalSubmit()) return;

    if (i.customId === 'wc_sig') {
      const input = i.fields.getTextInputValue('signed');
      const data = pending.get(i.user.id);

      if (!data || data.type !== 'wc') {
        await i.reply({
          content: '❌ Verification expired. Please start over with `/verify`',
          flags: 64,
        });
        return;
      }

      console.log(`🔍 Verifying EVM signature for ${i.user.tag}...`);

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
            content: `✅ **Wallet Verified!**\n\nYour EVM wallet: \`${recovered}\`\nYou now have access to exclusive channels and roles!`,
            flags: 64,
          });
          console.log(`✅ ${i.user.tag} successfully verified EVM wallet: ${recovered}`);
        } else {
          await i.reply({
            content: '❌ Invalid signature. Nonce mismatch. Please try again with `/verify`',
            flags: 64,
          });
          console.log(`❌ ${i.user.tag} failed EVM verification (nonce mismatch)`);
        }
      } catch (error) {
        console.error('WalletConnect verification error:', error);
        await i.reply({
          content: '❌ Invalid signature or JSON format. Please try again with `/verify`',
          flags: 64,
        });
      }
      pending.delete(i.user.id);
    }
  } catch (error) {
    console.error('Error in wc_sig handler:', error);
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
    console.log(`✅ Assigned roles to ${member.user.tag}: ${roles.map(r => r.name).join(', ')}`);
  } catch (error) {
    console.error(`❌ Error assigning roles to ${member.user.tag}:`, error);
  }
}

// Error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Start the bot
client.login(TOKEN);
