// Discord Bot for LeafTiers Website Integration
// This bot listens for /result command and updates the website

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const WEBSITE_URL = process.env.WEBSITE_URL || 'https://srv-dadgkt740ujc73e89g1g.onrender.com';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const API_KEY = process.env.DISCORD_BOT_API_KEY || 'leaf-tiers-secret-key-2024';

// Points calculation based on tier
function pointsForTier(tier) {
    const tierPoints = {
        'HT1': 45, 'MT1': 35, 'LT1': 25,
        'HT2': 20, 'MT2': 15, 'LT2': 10,
        'HT3': 8, 'MT3': 6, 'LT3': 4,
        'HT4': 3, 'MT4': 2, 'HT5': 1, 'LT5': 0
    };
    return tierPoints[tier] || 0;
}

// Register slash command
const commands = [
    new SlashCommandBuilder()
        .setName('result')
        .setDescription('Update player tier on the website')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Discord user')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Minecraft username')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('region')
                .setDescription('Region')
                .setRequired(true)
                .addChoices(
                    { name: 'NA', value: 'NA' },
                    { name: 'EU', value: 'EU' },
                    { name: 'ASIA', value: 'ASIA' },
                    { name: 'SA', value: 'SA' },
                    { name: 'OC', value: 'OC' }
                ))
        .addStringOption(option =>
            option.setName('previous_rank')
                .setDescription('Previous rank')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('Tier')
                .setRequired(true)
                .addChoices(
                    { name: 'High Tier 1', value: 'HT1' },
                    { name: 'Mid Tier 1', value: 'MT1' },
                    { name: 'Low Tier 1', value: 'LT1' },
                    { name: 'High Tier 2', value: 'HT2' },
                    { name: 'Mid Tier 2', value: 'MT2' },
                    { name: 'Low Tier 2', value: 'LT2' },
                    { name: 'High Tier 3', value: 'HT3' },
                    { name: 'Mid Tier 3', value: 'MT3' },
                    { name: 'Low Tier 3', value: 'LT3' },
                    { name: 'High Tier 4', value: 'HT4' },
                    { name: 'Mid Tier 4', value: 'MT4' },
                    { name: 'High Tier 5', value: 'HT5' },
                    { name: 'Low Tier 5', value: 'LT5' }
                ))
].map(command => command.toJSON());

// Register commands
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');

        const GUILD_ID = process.env.DISCORD_GUILD_ID;
        if (GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
                { body: commands }
            );
            console.log('Successfully reloaded guild (/) commands.');
        } else {
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log('Successfully reloaded global (/) commands.');
        }
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

    if (interaction.commandName === 'result') {
        const user = interaction.options.getUser('user');
        const username = interaction.options.getString('username');
        const region = interaction.options.getString('region');
        const previousRank = interaction.options.getString('previous_rank');
        const tier = interaction.options.getString('tier');
        
        // Default gamemode to Sword
        const gamemode = 'Sword';
        const points = pointsForTier(tier);

        await interaction.deferReply();

        try {
            const response = await fetch(`${WEBSITE_URL}/api/discord/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    username: username,
                    tier: tier,
                    points: points,
                    gamemode: gamemode,
                    region: region,
                    user: user.username
                })
            });

            const result = await response.json();

            if (result.success) {
                await interaction.editReply({
                    content: `✅ Successfully updated ${username} to ${tier} (${points}pts) in ${gamemode}!`,
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
