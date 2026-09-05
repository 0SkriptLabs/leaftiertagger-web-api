const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');

// Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const API_URL = 'http://localhost:3000/api/discord/update';
const API_KEY = process.env.DISCORD_BOT_API_KEY || 'leaf-tiers-secret-key-2024';

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
        .setName('results')
        .setDescription('Update a player\'s tier on the website')
        .addStringOption(option =>
            option.setName('ign')
                .setDescription('Minecraft username')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('Tier (e.g., HT1, MT1, LT1)')
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
                .setDescription('Region')
                .setRequired(false)
                .addChoices(
                    { name: 'NA', value: 'NA' },
                    { name: 'EU', value: 'EU' },
                    { name: 'ASIA', value: 'ASIA' },
                    { name: 'SA', value: 'SA' },
                    { name: 'OC', value: 'OC' }
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
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands }
            );
            console.log('Successfully reloaded application (/) commands.');
        }
    } catch (error) {
        console.error('Error registering commands:', error);
    }
})();

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'results') {
        const ign = interaction.options.getString('ign');
        const tier = interaction.options.getString('tier');
        const gamemode = interaction.options.getString('gamemode');
        const region = interaction.options.getString('region') || 'NA';
        const points = pointsForTier(tier);

        try {
            const response = await axios.post(API_URL, {
                username: ign,
                tier: tier,
                points: points,
                gamemode: gamemode,
                region: region,
                user: interaction.user.username
            }, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success) {
                await interaction.reply({
                    content: `✅ Successfully updated ${ign} to ${tier} (${points}pts) in ${gamemode} on the website!`,
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