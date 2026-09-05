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
            players: {}
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
}

// API endpoint for the Minecraft mod to get all tiers
app.get('/api/tiers', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            res.json(data);
        } else {
            res.json({ players: {} });
        }
    } catch (error) {
        console.error('Error reading tier data:', error);
        res.status(500).json({ error: 'Failed to read tier data' });
    }
});

// API endpoint to get a specific player's tier
app.get('/api/tiers/:username', (req, res) => {
    try {
        const username = req.params.username.toLowerCase();
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            if (data.players[username]) {
                res.json(data.players[username]);
            } else {
                res.status(404).json({ error: 'Player not found' });
            }
        } else {
            res.status(404).json({ error: 'Player not found' });
        }
    } catch (error) {
        console.error('Error reading tier data:', error);
        res.status(500).json({ error: 'Failed to read tier data' });
    }
});

// Discord bot endpoint to update tiers (only way to add/update players)
app.post('/api/discord/update', (req, res) => {
    try {
        // Verify API key
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const providedKey = authHeader.substring(7);
        if (providedKey !== DISCORD_BOT_API_KEY) {
            return res.status(403).json({ error: 'Invalid API key' });
        }

        const { username, tier, points, gamemode, region, user } = req.body;
        
        if (!username || !tier || !gamemode) {
            return res.status(400).json({ error: 'Username, tier, and gamemode are required' });
        }
        
        // Initialize data file if needed
        initDataFile();
        
        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        const usernameLower = username.toLowerCase();
        
        // Initialize player if doesn't exist
        if (!data.players[usernameLower]) {
            data.players[usernameLower] = {
                displayName: username,
                gamemodes: {}
            };
        }
        
        // Add/update tier for specific gamemode
        data.players[usernameLower].gamemodes[gamemode] = {
            tier: tier,
            points: points || 0,
            region: region || 'NA'
        };
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        
        // Notify connected clients about the update
        notifyClients();
        
        res.json({ success: true, message: `Updated ${username} to ${tier} in ${gamemode}` });
    } catch (error) {
        console.error('Error updating tier data:', error);
        res.status(500).json({ error: 'Failed to update tier data' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
initDataFile();
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server ready`);
});