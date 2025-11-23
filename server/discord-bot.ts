// Shield Finance Discord Bot
// Handles universal wallet verification (Xaman + WalletConnect)
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  Interaction,
  GuildMember,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { ethers } from 'ethers';

const pending = new Map<string, { type: 'xaman'; address: string; challenge: string } | { type: 'wc'; nonce: number }>();

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
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.once('ready', async () => {
    console.log(`✅ Discord Bot online as ${client.user?.tag}`);
    console.log(`🔐 Monitoring guild: ${GUILD_ID}`);

    try {
      // Properly fetch the guild before registering commands
      const guild = await client.guilds.fetch(GUILD_ID);
      
      await guild.commands.set([
        new SlashCommandBuilder()
          .setName('verify')
          .setDescription('Verify with any wallet (Xaman or WalletConnect)'),
      ]);
      console.log('✅ Discord slash commands registered');
    } catch (error) {
      console.error('❌ Error registering slash commands:', error);
    }
  });

  // Consolidated interaction handler - all interactions in one listener
  client.on('interactionCreate', async (interaction: Interaction) => {
    try {
      // Handle /verify command
      if (interaction.isChatInputCommand() && interaction.commandName === 'verify') {
        await handleVerifyCommand(interaction);
        return;
      }
      
      // Handle verify_btn button
      if (interaction.isButton() && interaction.customId === 'verify_btn') {
        await handleVerifyCommand(interaction);
        return;
      }

      // Handle button interactions
      if (interaction.isButton()) {
        switch (interaction.customId) {
          case 'xaman_verify':
            await handleXamanVerifyButton(interaction);
            break;
          case 'wc_verify':
            await handleWalletConnectButton(interaction);
            break;
        }
        return;
      }

      // Handle modal submissions
      if (interaction.isModalSubmit()) {
        switch (interaction.customId) {
          case 'xaman_modal':
            await handleXamanAddressModal(interaction);
            break;
          case 'xaman_sig':
            await handleXamanSignatureModal(interaction);
            break;
          case 'wc_sig':
            await handleWalletConnectSignatureModal(interaction);
            break;
        }
        return;
      }
    } catch (error) {
      console.error('Error in interaction handler:', error);
    }
  });

  // Handler functions
  async function handleVerifyCommand(interaction: ChatInputCommandInteraction | ButtonInteraction) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('xaman_verify')
        .setLabel('Xaman / Classic Wallet')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('wc_verify')
        .setLabel('WalletConnect (MetaMask, etc.)')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: 'Choose your wallet type:',
      components: [row],
      ephemeral: true,
    });
  }

  async function handleXamanVerifyButton(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
      .setCustomId('xaman_modal')
      .setTitle('XRPL Address');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('addr')
          .setLabel('r-address (starts with r)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    await interaction.showModal(modal);
  }

  async function handleXamanAddressModal(interaction: ModalSubmitInteraction) {
    const address = interaction.fields.getTextInputValue('addr');
    const challenge = `Shield Finance verification ${Date.now()}-${interaction.user.id}`;
    pending.set(interaction.user.id, { type: 'xaman', address, challenge });

    const modal2 = new ModalBuilder()
      .setCustomId('xaman_sig')
      .setTitle('Sign & Verify');
    modal2.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('sig')
          .setLabel('Paste signature from Xaman')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder(`First, sign this in Xaman:\n${challenge}`)
      )
    );
    // Discord.js v14.13+ supports showing modals from modal submissions
    // Type assertion needed due to TypeScript types not being fully updated
    await (interaction as any).showModal(modal2);
  }

  async function handleXamanSignatureModal(interaction: ModalSubmitInteraction) {
    const sig = interaction.fields.getTextInputValue('sig');
    const data = pending.get(interaction.user.id);

    if (!data) {
      await interaction.reply({ 
        content: '❌ Verification expired. Please start over with `/verify`', 
        ephemeral: true 
      });
      return;
    }

    if (data.type !== 'xaman') {
      await interaction.reply({
        content: '❌ Invalid verification type.',
        ephemeral: true
      });
      return;
    }

    try {
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
        if (interaction.member instanceof GuildMember) {
          await giveRoles(interaction.member);
        }
        await interaction.reply({
          content: `✅ **Wallet Verified!**\n\nYour XRPL address: \`${data.address}\`\nYou now have access to exclusive channels!`,
          ephemeral: true,
        });
        console.log(`✅ ${interaction.user.tag} verified XRPL: ${data.address}`);
      } else {
        await interaction.reply({
          content: '❌ Invalid signature. Please try again.',
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('Xaman verification error:', error);
      await interaction.reply({
        content: '❌ Verification error. Please try again.',
        ephemeral: true,
      });
    }
    pending.delete(interaction.user.id);
  }

  async function handleWalletConnectButton(interaction: ButtonInteraction) {
    const nonce = Math.floor(Math.random() * 1e9);
    pending.set(interaction.user.id, { type: 'wc', nonce });

    const modal = new ModalBuilder()
      .setCustomId('wc_sig')
      .setTitle('Paste Signed Message');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('signed')
          .setLabel('JSON from wallet (nonce: ' + nonce + ')')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('Sign with your wallet, then paste the full JSON here')
      )
    );
    await interaction.showModal(modal);
  }

  async function handleWalletConnectSignatureModal(interaction: ModalSubmitInteraction) {
    const input = interaction.fields.getTextInputValue('signed');
    const data = pending.get(interaction.user.id);

    if (!data || data.type !== 'wc') {
      await interaction.reply({
        content: '❌ Verification expired. Please start over.',
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
        if (interaction.member instanceof GuildMember) {
          await giveRoles(interaction.member);
        }
        await interaction.reply({
          content: `✅ **Wallet Verified!**\n\nYour EVM wallet: \`${recovered}\`\nYou now have access to exclusive channels!`,
          ephemeral: true,
        });
        console.log(`✅ ${interaction.user.tag} verified EVM: ${recovered}`);
      } else {
        await interaction.reply({
          content: '❌ Invalid signature. Nonce mismatch.',
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('WalletConnect verification error:', error);
      await interaction.reply({
        content: '❌ Invalid signature or JSON format.',
        ephemeral: true,
      });
    }
    pending.delete(interaction.user.id);
  }

  async function giveRoles(member: GuildMember) {
    try {
      const roles = [
        'Shield Holder',
        'Verified Wallet',
        'Staker',
      ]
        .map((name) => member.guild.roles.cache.find((r) => r.name === name))
        .filter((r): r is NonNullable<typeof r> => r !== undefined);

      if (roles.length > 0) {
        await member.roles.add(roles);
        console.log(`✅ Assigned roles to ${member.user.tag}`);
      } else {
        console.warn(`⚠️  No matching roles found for ${member.user.tag}`);
      }
    } catch (error) {
      console.error(`❌ Error assigning roles:`, error);
    }
  }

  client.on('error', (error) => {
    console.error('Discord client error:', error);
  });

  // Add proper error handling for login
  try {
    await client.login(TOKEN);
    console.log('✅ Discord bot logged in successfully');
  } catch (error) {
    console.error('❌ Discord bot login failed:', error);
    throw error;
  }

  return client;
}
