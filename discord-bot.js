// Discord Bot for LeafTiers Website Integration
// This bot listens for /results command and updates the website

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const WEBSITE_URL = process.env.WEBSITE_URL || 'http://localhost:3000';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const WEBSITE_BOT_TOKEN = process.env.WEBSITE_BOT_TOKEN;

// Register slash command
const commands = [
    new SlashCommandBuilder()
        .setName('results')
        .setDescription('Update player tier on the website')
        .addStringOption(option =>
            option.setName('user')
                .setDescription('Discord username')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('ign')
                .setDescription('Minecraft IGN')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('Tier (e.g., HT1, MT1, LT1, HT2, etc.)')
                .setRequired(true)
                .addChoices(
                    { name: 'HT1', value: 'HT1' },
                    { name: 'MT1', value: 'MT1' },
                    { name: 'LT1', value: 'LT1' },
                    { name: 'HT2', value: 'HT2' },
                    { name: 'MT2', value: 'MT2' },
                    { name: 'LT2', value: 'LT2' },
                    { name: 'HT3', value: 'HT3' },
                    { name: 'MT3', value: 'MT3' },
                    { name: 'LT3', value: 'LT3' },
                    { name: 'HT4', value: 'HT4' },
                    { name: 'MT4', value: 'MT4' },
                    { name: 'HT5', value: 'HT5' },
                    { name: 'LT5', value: 'LT5' }
                ))
        .addStringOption(option =>
            option.setName('gamemode')
                .setDescription('Gamemode')
                .setRequired(true)
                .addChoices(
                    { name: 'Sword', value: 'Sword' },
                    { name: 'Axe', value: 'Axe' },
                    { name: 'Mace', value: 'Mace' },
                    { name: 'Vanilla', value: 'Vanilla' },
                    { name: 'UHC', value: 'UHC' },
                    { name: 'Pot', value: 'Pot' },
                    { name: 'NethOP', value: 'NethOP' },
                    { name: 'SMP', value: 'SMP' }
                ))
        .addStringOption(option =>
            option.setName('region')
                .setDescription('Region (default: NA)')
                .setRequired(false)
                .addChoices(
                    { name: 'NA', value: 'NA' },
                    { name: 'EU', value: 'EU' },
                    { name: 'AS', value: 'AS' },
                    { name: 'SA', value: 'SA' }
                ))
].map(command => command.toJSON());

// Register commands
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await registerCommands();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'results') {
        const user = interaction.options.getString('user');
        const ign = interaction.options.getString('ign');
        const tier = interaction.options.getString('tier');
        const gamemode = interaction.options.getString('gamemode');
        const region = interaction.options.getString('region') || 'NA';

        await interaction.deferReply();

        try {
            const response = await fetch(`${WEBSITE_URL}/api/discord/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bot_token: WEBSITE_BOT_TOKEN,
                    user,
                    ign,
                    tier,
                    gamemode,
                    region
                })
            });

            const result = await response.json();

            if (result.success) {
                await interaction.editReply({
                    content: `✅ Successfully updated ${ign} to ${tier} in ${gamemode}!`,
                    ephemeral: false
                });
            } else {
                await interaction.editReply({
                    content: `❌ Error: ${result.error}`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error updating website:', error);
            await interaction.editReply({
                content: '❌ Failed to update website. Please try again later.',
                ephemeral: true
            });
        }
    }
});

client.login(BOT_TOKEN);
