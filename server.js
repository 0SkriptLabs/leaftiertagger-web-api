const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const TIERS_FILE = path.join(__dirname, 'tiers.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'P6$zT2!nV9#qD4@kY7Er';

// Read tiers from file
function readTiers() {
    try {
        const data = fs.readFileSync(TIERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { players: {} };
    }
}

// Write tiers to file
function writeTiers(data) {
    fs.writeFileSync(TIERS_FILE, JSON.stringify(data, null, 2));
}

// Function to calculate tier based on points
function calculateTierFromPoints(points) {
    if (points >= 45) return 'HT1';
    if (points >= 20) return 'HT2';
    if (points >= 6) return 'HT3';
    if (points >= 3) return 'HT4';
    if (points >= 1) return 'HT5';
    return 'LT5'; // Default for 0 points
}

// GET API endpoint - returns tier data for Minecraft mod
app.get('/api/tiers', (req, res) => {
    const data = readTiers();
    
    // Convert new structure to format expected by Minecraft mod
    const modFormat = {};
    
    for (const [username, playerData] of Object.entries(data.players)) {
        // For backward compatibility, use the first tier found or default
        const gamemodes = playerData.gamemodes || {};
        const firstGamemode = Object.keys(gamemodes)[0] || 'Sword';
        const tierData = gamemodes[firstGamemode] || { tier: 'LT3', points: 0, region: 'NA' };
        
        // Auto-calculate tier based on points if not explicitly set
        const calculatedTier = calculateTierFromPoints(tierData.points || 0);
        
        modFormat[username] = {
            tier: calculatedTier,
            gamemode: firstGamemode,
            region: tierData.region,
            displayName: playerData.displayName || username
        };
    }
    
    res.json({ players: modFormat });
});

// GET API endpoint - returns full tier data for web interface
app.get('/api/tiers/full', (req, res) => {
    const data = readTiers();
    res.json(data);
});

// POST API endpoint - add/update player tier
app.post('/api/tiers', (req, res) => {
    const { username, tier, gamemode, region, points, password } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Invalid password' });
    }
    
    if (!username || !tier || !gamemode) {
        return res.status(400).json({ success: false, error: 'Username, tier, and gamemode are required' });
    }
    
    const data = readTiers();
    
    if (!data.players[username]) {
        data.players[username] = {
            displayName: username,
            gamemodes: {}
        };
    }
    
    data.players[username].gamemodes[gamemode] = {
        tier: tier,
        points: points || 0,
        region: region || 'NA'
    };
    
    writeTiers(data);
    
    res.json({ success: true, message: `Updated ${username} to ${tier} (${points} points) in ${gamemode}` });
});

// DELETE API endpoint - remove player tier for specific gamemode
app.delete('/api/tiers/:username', (req, res) => {
    const { username } = req.params;
    const { password, gamemode } = req.query;
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Invalid password' });
    }
    
    const data = readTiers();
    
    if (!data.players[username]) {
        return res.status(404).json({ success: false, error: 'Player not found' });
    }
    
    if (gamemode) {
        // Remove specific gamemode tier
        delete data.players[username].gamemodes[gamemode];
        
        // If no gamemodes left, remove the player entirely
        if (Object.keys(data.players[username].gamemodes).length === 0) {
            delete data.players[username];
        }
    } else {
        // Remove entire player
        delete data.players[username];
    }
    
    writeTiers(data);
    
    res.json({ success: true, message: `Removed ${username}${gamemode ? ' from ' + gamemode : ''}` });
});

// Admin authentication endpoint
app.post('/api/auth', (req, res) => {
    const { password } = req.body;
    
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});