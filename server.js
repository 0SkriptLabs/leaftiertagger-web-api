const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Discord Bot API Key (should be set as environment variable)
const DISCORD_BOT_API_KEY = process.env.DISCORD_BOT_API_KEY || 'leaf-tiers-secret-key-2024';

// Data file
const DATA_FILE = path.join(__dirname, 'tiers.json');

// Store connected WebSocket clients
const clients = new Set();

// WebSocket connection handling
wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('New client connected');
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Function to notify all connected clients of updates
function notifyClients() {
    const message = JSON.stringify({ type: 'update', timestamp: new Date().toISOString() });
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (error) {
                console.error('Error sending to client:', error);
                clients.delete(client);
            }
        }
    });
}

// Initialize data file if it doesn't exist
function initDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            players: {
                "Steve": {
                    tier: "LT3",
                    color: "gold",
                    displayName: "Steve"
                },
                "Alex": {
                    tier: "HT1",
                    color: "red",
                    displayName: "Alex"
                }
            }
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
}

// API endpoint for the Minecraft mod
app.get('/api/tiers', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            res.json(data);
        } else {
            res.json({ players: {} });
        }
    } catch (error) {
        console.error('Error reading data file:', error);
        res.status(500).json({ error: 'Failed to read tier data' });
    }
});

// API endpoint to get a specific player's tier
app.get('/api/tiers/:username', (req, res) => {
    try {
        const username = req.params.username.toLowerCase();
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            const playerData = data.players[username];
            if (playerData) {
                res.json(playerData);
            } else {
                res.status(404).json({ error: 'Player not found' });
            }
        } else {
            res.status(404).json({ error: 'Player not found' });
        }
    } catch (error) {
        console.error('Error reading player data:', error);
        res.status(500).json({ error: 'Failed to read player data' });
    }
});

// API endpoint to update/add a player's tier
app.post('/api/tiers', (req, res) => {
    try {
        const { username, tier, points, gamemode, region, color, displayName } = req.body;
        
        if (!username || !tier) {
            return res.status(400).json({ error: 'Username and tier are required' });
        }
        
        let data = { players: {} };
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
        
        const usernameLower = username.toLowerCase();
        
        // Initialize player if doesn't exist
        if (!data.players[usernameLower]) {
            data.players[usernameLower] = {
                displayName: displayName || username,
                gamemodes: {}
            };
        }
        
        // Add/update tier for specific gamemode
        if (gamemode) {
            data.players[usernameLower].gamemodes[gamemode] = {
                tier: tier,
                points: points || 0,
                region: region || 'NA'
            };
        } else {
            // Legacy support - if no gamemode specified, just set main tier
            data.players[usernameLower].tier = tier;
            data.players[usernameLower].color = color || 'gold';
            data.players[usernameLower].displayName = displayName || username;
        }
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        // Notify connected clients about the update
        notifyClients();
        
        res.json({ success: true, message: `Updated ${username} to ${tier}` });
    } catch (error) {
        console.error('Error updating tier data:', error);
        res.status(500).json({ error: 'Failed to update tier data' });
    }
});

// API endpoint to delete a player
app.delete('/api/tiers/:username', (req, res) => {
    try {
        const username = req.params.username.toLowerCase();
        const gamemode = req.query.gamemode;
        
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            if (data.players[username]) {
                if (gamemode && data.players[username].gamemodes) {
                    // Delete specific gamemode tier
                    delete data.players[username].gamemodes[gamemode];
                    
                    // If no more gamemodes, delete the player entirely
                    if (Object.keys(data.players[username].gamemodes).length === 0) {
                        delete data.players[username];
                    }
                    
                    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
                    
                    // Notify connected clients about the update
                    notifyClients();
                    
                    res.json({ success: true, message: `Deleted ${username} from ${gamemode}` });
                } else {
                    // Delete entire player
                    delete data.players[username];
                    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
                    
                    // Notify connected clients about the update
                    notifyClients();
                    
                    res.json({ success: true, message: `Deleted ${username}` });
                }
            } else {
                res.status(404).json({ error: 'Player not found' });
            }
        } else {
            res.status(404).json({ error: 'Player not found' });
        }
    } catch (error) {
        console.error('Error deleting player:', error);
        res.status(500).json({ error: 'Failed to delete player' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Discord Bot endpoint to update tiers from /results command
app.post('/api/discord/update', (req, res) => {
    try {
        // Verify API key from Discord bot
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized - Missing API key' });
        }
        
        const token = authHeader.substring(7);
        if (token !== DISCORD_BOT_API_KEY) {
            return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
        }
        
        const { username, tier, ign, user } = req.body;
        
        if (!username || !tier) {
            return res.status(400).json({ error: 'Username and tier are required' });
        }
        
        let data = { players: {} };
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
        
        // Determine color based on tier
        let color = 'gold';
        if (tier.startsWith('LT')) color = 'gold';
        else if (tier.startsWith('MT')) color = 'diamond';
        else if (tier.startsWith('HT')) color = 'red';
        
        data.players[username.toLowerCase()] = {
            tier: tier,
            color: color,
            displayName: ign || username,
            user: user || null
        };
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        // Notify connected clients about the update
        notifyClients();
        
        res.json({ success: true, message: `Updated ${username} to ${tier}` });
    } catch (error) {
        console.error('Error processing Discord bot update:', error);
        res.status(500).json({ error: 'Failed to process update' });
    }
});

// Initialize and start server
initDataFile();

server.listen(PORT, () => {
    console.log(`Leaf Tier Tagger API running on port ${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/tiers`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});