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
            option.setName('user')
                .setDescription('Discord username')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('ign')
                .setDescription('Minecraft username')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('Tier (e.g., HT1, MT1, LT1)')
                .setRequired(true))
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
        const user = interaction.options.getString('user');
        const ign = interaction.options.getString('ign');
        const tier = interaction.options.getString('tier');

        try {
            const response = await axios.post(API_URL, {
                username: ign,
                tier: tier,
                user: user
            }, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.success) {
                await interaction.reply({
                    content: `✅ Successfully updated ${ign} to ${tier} on the website!`,
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