const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');

// Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const API_URL = 'https://srv-dadgkt740ujc73e89g1g.onrender.com/api/discord/update';
const API_KEY = process.env.DISCORD_BOT_API_KEY || 'leaf-tiers-secret-key-2024';
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN) {
    console.error('DISCORD_TOKEN environment variable is required');
    process.exit(1);
}

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

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Register slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('result')
        .setDescription('Update a player\'s tier on the website')
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
                .setDescription('Tier (e.g., High Tier 1, Mid Tier 1, Low Tier 1)')
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

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        
        // Replace YOUR_CLIENT_ID with your actual Discord application client ID
        const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
        if (!CLIENT_ID) {
            console.warn('DISCORD_CLIENT_ID not set. Commands will not be registered.');
        } else {
            // If guild ID is provided, register guild commands (instant)
            // Otherwise register global commands (can take up to an hour)
            if (GUILD_ID) {
                await rest.put(
                    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                    { body: commands }
                );
                console.log('Successfully reloaded guild (/) commands.');
            } else {
                await rest.put(
                    Routes.applicationCommands(CLIENT_ID),
                    { body: commands }
                );
                console.log('Successfully reloaded global (/) commands (may take up to an hour to propagate).');
            }
        }
    } catch (error) {
        console.error('Error registering commands:', error);
    }
})();

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'result') {
        const user = interaction.options.getUser('user');
        const username = interaction.options.getString('username');
        const region = interaction.options.getString('region');
        const previousRank = interaction.options.getString('previous_rank');
        const tier = interaction.options.getString('tier');
        
        // Default gamemode to Sword since it's not in the command
        const gamemode = 'Sword';
        const points = pointsForTier(tier);

        try {
            const response = await axios.post(API_URL, {
                username: username,
                tier: tier,
                points: points,
                gamemode: gamemode,
                region: region,
                user: user.username
            }, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success) {
                await interaction.reply({
                    content: `✅ Successfully updated ${username} to ${tier} (${points}pts) in ${gamemode} on the website!`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `❌ Error: ${response.data.error}`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error updating website:', error);
            await interaction.reply({
                content: '❌ Failed to update the website. Please try again later.',
                ephemeral: true
            });
        }
    }
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);