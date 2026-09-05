// ADD THIS TO YOUR index.js (on WispByte) IN THE TOP SECTION WITH OTHER CONSTANTS

// Web API configuration
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://srv-dadgkt740ujc73e89g1g.onrender.com';
const WEBSITE_API_KEY = process.env.DISCORD_BOT_API_KEY || 'leaf-tiers-secret-key-2024';

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

// ========================================================
// ADD THIS FUNCTION INSIDE THE /result COMMAND HANDLER
// AFTER the "await updateTierRole(interaction.guild, user.id, tier);" line
// ========================================================

// Update website
try {
  const points = pointsForTier(tier);
  const gamemode = 'Sword'; // Default gamemode
  
  const websiteResponse = await fetch(`${WEBSITE_URL}/api/discord/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WEBSITE_API_KEY}`
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
  
  const websiteResult = await websiteResponse.json();
  
  if (websiteResult.success) {
    console.log(`✅ Updated ${username} on website to ${tier}`);
  } else {
    console.error(`❌ Failed to update website: ${websiteResult.error}`);
  }
} catch (error) {
  console.error('Error updating website:', error);
}

// ========================================================
// ADD THESE ENVIRONMENT VARIABLES TO YOUR WISPBYTE BOT
// ========================================================
// WEBSITE_URL=https://srv-dadgkt740ujc73e89g1g.onrender.com
// DISCORD_BOT_API_KEY=leaf-tiers-secret-key-2024
// ========================================================