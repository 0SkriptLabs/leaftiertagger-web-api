require("dotenv").config();
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");

const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const token = process.env.DISCORD_TOKEN?.trim();
const VERIFY_SECRET = process.env.MINECRAFT_VERIFY_SECRET?.trim();
const VERIFY_PORT = Number(process.env.MINECRAFT_VERIFY_PORT || 9181);
const VERIFY_CODE_LIFETIME = 10 * 60 * 1000;

const WEBSITE_URL = 'https://leaftiertagger-web-api.onrender.com';
const WEBSITE_API_KEY = 'leaf-tiers-secret-key-2024';

function pointsForTier(tier) {
  const tierPoints = {
    'HT1': 45, 'MT1': 35, 'LT1': 25,
    'HT2': 20, 'MT2': 15, 'LT2': 10,
    'HT3': 8, 'MT3': 6, 'LT3': 4,
    'HT4': 3, 'MT4': 2, 'HT5': 1, 'LT5': 0
  };
  return tierPoints[tier] || 0;
}

const GUILD_ID = "1530708697796448346";

const STAFF_ROLE_ID = "1530711943982350466";
const WAITLIST_ROLE_ID = "1530917943297314846";
const SUPPORT_STAFF_ROLE_ID = "1531010334163472525";

const RESULTS_CHANNEL = "1530746814142353438";
const HIGH_RESULTS_CHANNEL = "1530746628137291776";
const QUEUE_CHANNEL = "1544776475973263491";
const REQUEST_TEST_CHANNEL = "1530748199109660733";
const SUPPORT_TICKETS_CHANNEL = "1530748303648489512";
const REPORT_STAFF_CHANNEL = "1530748327136591874";
const REPORT_LOG_CHANNEL = "1544780365091184730";

const DATA_FILE = "./queue-data.json";

const ONE_DAY = 24 * 60 * 60 * 1000;

const tierNames = {
  LT5: "Low Tier 5",
  MT5: "Mid Tier 5",
  HT5: "High Tier 5",
  LT4: "Low Tier 4",
  MT4: "Mid Tier 4",
  HT4: "High Tier 4",
  LT3: "Low Tier 3",
  MT3: "Mid Tier 3",
  HT3: "High Tier 3",
  LT2: "Low Tier 2",
  MT2: "Mid Tier 2",
  HT2: "High Tier 2",
  LT1: "Low Tier 1",
  MT1: "Mid Tier 1",
  HT1: "High Tier 1"
};

const tierRoles = {
  LT5: "1530727460222664704",
  MT5: "1545454207971098624",
  HT5: "1530727544670785647",
  LT4: "1530727569127641208",
  MT4: "1545454313671889028",
  HT4: "1530742126370095255",
  LT3: "1530727647703859240",
  MT3: "1545454478155718696",
  HT3: "1530727689735114983",
  LT2: "1530741790905335938",
  MT2: "1545454590533570702",
  HT2: "1530727600580989118",
  LT1: "1530741872778281070",
  MT1: "1545454693453398056",
  HT1: "1530742005255245874"
};

const allTierRoleIds = Object.values(tierRoles);

const HIGH_TIERS = [
  "LT3",
  "MT3",
  "HT3",
  "LT2",
  "MT2",
  "HT2",
  "LT1",
  "MT1",
  "HT1"
];

const tierChoices = Object.entries(tierNames).map(
  ([value, name]) => ({
    name,
    value
  })
);

let queueData = {
  open: false,
  queue: [],
  queueMessageId: null,
  requestMessageId: null,
  supportPanelMessageId: null,
  reportPanelMessageId: null,
  lastTestingSession: null,
  activeTesters: [],
  testingTickets: {},
  autoTestingTicketId: null,
  supportTickets: {},
  lastPositions: {},
  verifiedUsers: {},
  pendingVerifications: {},
  ticketCooldowns: {}
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;

    const saved = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    queueData = {
      ...queueData,
      ...saved
    };

    if (!Array.isArray(queueData.queue)) {
      queueData.queue = [];
    }

    if (!Array.isArray(queueData.activeTesters)) {
      queueData.activeTesters = [];
    }

    if (
      !queueData.testingTickets ||
      typeof queueData.testingTickets !== "object"
    ) {
      queueData.testingTickets = {};
    }

    if (
      queueData.autoTestingTicketId === undefined
    ) {
      queueData.autoTestingTicketId = null;
    }

    if (
      !queueData.supportTickets ||
      typeof queueData.supportTickets !== "object"
    ) {
      queueData.supportTickets = {};
    }

    if (
      !queueData.lastPositions ||
      typeof queueData.lastPositions !== "object"
    ) {
      queueData.lastPositions = {};
    }

    if (
      !queueData.verifiedUsers ||
      typeof queueData.verifiedUsers !== "object"
    ) {
      queueData.verifiedUsers = {};
    }

    if (
      !queueData.pendingVerifications ||
      typeof queueData.pendingVerifications !== "object"
    ) {
      queueData.pendingVerifications = {};
    }

    if (
      !queueData.ticketCooldowns ||
      typeof queueData.ticketCooldowns !== "object"
    ) {
      queueData.ticketCooldowns = {};
    }

    if (queueData.activeTestTicket) {
      const oldTicket = queueData.activeTestTicket;

      if (
        oldTicket.channelId &&
        oldTicket.userId &&
        !queueData.testingTickets[oldTicket.channelId]
      ) {
        queueData.testingTickets[oldTicket.channelId] = {
          userId: oldTicket.userId,
          type: "auto",
          createdAt: Date.now()
        };

        queueData.autoTestingTicketId =
          oldTicket.channelId;
      }

      delete queueData.activeTestTicket;
    }

    saveData();
  } catch (error) {
    console.error(
      "Could not load saved data:",
      error
    );
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        queueData,
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      "Could not save data:",
      error
    );
  }
}

loadData();

async function isStaffOrAbove(
  guild,
  userId
) {
  const member = await guild.members
    .fetch(userId)
    .catch(() => null);

  if (!member) return false;

  if (
    member.permissions.has(
      PermissionFlagsBits.Administrator
    )
  ) {
    return true;
  }

  const staffRole =
    guild.roles.cache.get(
      STAFF_ROLE_ID
    ) ||
    await guild.roles
      .fetch(STAFF_ROLE_ID)
      .catch(() => null);

  if (!staffRole) return false;

  return (
    member.roles.highest.position >=
    staffRole.position
  );
}

function sendMessageModal() {
  const modal =
    new ModalBuilder()
      .setCustomId(
        "send_message_modal"
      )
      .setTitle(
        "Send Message"
      );

  const messageInput =
    new TextInputBuilder()
      .setCustomId(
        "send_message_content"
      )
      .setLabel(
        "Message"
      )
      .setStyle(
        TextInputStyle.Paragraph
      )
      .setRequired(true)
      .setMaxLength(4000);

  modal.addComponents(
    new ActionRowBuilder()
      .addComponents(
        messageInput
      )
  );

  return modal;
}

async function getNameMcUuid(ign) {
  const response =
    await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(ign)}`
    );

  if (!response.ok) {
    return null;
  }

  const data =
    await response.json();

  if (
    !data ||
    !data.id ||
    data.id.length !== 32
  ) {
    return null;
  }

  const id =
    data.id;

  return (
    id.slice(0, 8) +
    "-" +
    id.slice(8, 12) +
    "-" +
    id.slice(12, 16) +
    "-" +
    id.slice(16, 20) +
    "-" +
    id.slice(20)
  );
}

function cleanExpiredVerificationCodes() {
  const now = Date.now();
  let changed = false;

  for (
    const [code, data]
    of Object.entries(
      queueData.pendingVerifications
    )
  ) {
    if (
      !data ||
      !data.userId ||
      !data.expiresAt ||
      data.expiresAt <= now
    ) {
      delete queueData.pendingVerifications[
        code
      ];

      changed = true;
    }
  }

  if (changed) {
    saveData();
  }
}

function createVerificationCode(
  userId
) {
  cleanExpiredVerificationCodes();

  for (
    const [code, data]
    of Object.entries(
      queueData.pendingVerifications
    )
  ) {
    if (
      data?.userId === userId
    ) {
      delete queueData.pendingVerifications[
        code
      ];
    }
  }

  let code;

  do {
    code =
      "LF-" +
      crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase();
  } while (
    queueData.pendingVerifications[
      code
    ]
  );

  queueData.pendingVerifications[
    code
  ] = {
    userId,
    expiresAt:
      Date.now() +
      VERIFY_CODE_LIFETIME
  };

  saveData();

  return code;
}

function findVerificationByCode(
  code
) {
  cleanExpiredVerificationCodes();

  const normalizedCode =
    String(code || "")
      .trim()
      .toUpperCase();

  const pending =
    queueData.pendingVerifications[
      normalizedCode
    ];

  if (!pending) {
    return null;
  }

  return {
    code: normalizedCode,
    ...pending
  };
}

function cleanExpiredCooldowns() {
  const now = Date.now();

  let changed = false;

  for (
    const [userId, expiresAt]
    of Object.entries(
      queueData.ticketCooldowns
    )
  ) {
    if (
      !expiresAt ||
      expiresAt <= now
    ) {
      delete queueData.ticketCooldowns[
        userId
      ];

      changed = true;
    }
  }

  if (changed) {
    saveData();
  }
}

function getCooldownRemaining(userId) {
  cleanExpiredCooldowns();

  const expiresAt =
    queueData.ticketCooldowns[
      userId
    ];

  if (
    !expiresAt ||
    expiresAt <= Date.now()
  ) {
    return null;
  }

  return expiresAt;
}

async function getQueueChannel() {
  const channel =
    await client.channels
      .fetch(QUEUE_CHANNEL)
      .catch(() => null);

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    return null;
  }

  return channel;
}

function requestTestEmbed() {
  return new EmbedBuilder()
    .setColor(0xed145b)
    .setTitle("Evaluation Testing Waitlist")
    .setDescription(
      `Upon applying, you will be added to the testing waitlist.\n` +
      `Here you will be notified when a tester is available.\n\n` +
      `Verify your Minecraft account before entering the waitlist.\n\n` +
      `Press Verify Account to get a unique code, join **verify.leaftierlist.co.uk**, and run **/verify <code>** in-game.\n\n` +
      `Your Minecraft username and UUID will be taken directly from the account you join with.\n\n` +
      `Once a testing ticket is created for you, you will have a 24-hour cooldown before you can join the queue again.\n\n` +
      `**Failure to provide authentic information may result in a denied test.**`
    );
}

function requestTestButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("verify_account")
        .setLabel("Verify Account")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("enter_waitlist")
        .setLabel("Enter Waitlist")
        .setStyle(ButtonStyle.Primary)
    );
}

async function updateRequestTestPanel() {
  const channel =
    await client.channels
      .fetch(
        REQUEST_TEST_CHANNEL
      )
      .catch(() => null);

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    console.error(
      "Request test channel could not be found."
    );

    return;
  }

  let message = null;

  if (
    queueData.requestMessageId
  ) {
    message =
      await channel.messages
        .fetch(
          queueData.requestMessageId
        )
        .catch(() => null);
  }

  if (message) {
    await message.edit({
      embeds: [
        requestTestEmbed()
      ],
      components: [
        requestTestButtons()
      ]
    });

    return;
  }

  const sent =
    await channel.send({
      embeds: [
        requestTestEmbed()
      ],
      components: [
        requestTestButtons()
      ]
    });

  queueData.requestMessageId =
    sent.id;

  saveData();
}

function preferredServerModal() {
  const modal =
    new ModalBuilder()
      .setCustomId(
        "preferred_server_modal"
      )
      .setTitle(
        "Enter Testing Server"
      );

  const serverInput =
    new TextInputBuilder()
      .setCustomId(
        "preferred_server"
      )
      .setLabel(
        "Preferred Server / IP"
      )
      .setPlaceholder(
        "Enter your preferred testing server"
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setMaxLength(100)
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder()
      .addComponents(
        serverInput
      )
  );

  return modal;
}

function supportTicketEmbed() {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(
      "Support Tickets"
    )
    .setDescription(
      `If you require support, you may open a ticket.\n` +
      `Before opening one, please check whether you can resolve the issue yourself.\n\n` +
      `**Please have all necessary information ready before opening a ticket.**`
    );
}

function supportTicketButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "support_ticket_open"
        )
        .setLabel(
          "Open Ticket"
        )
        .setStyle(
          ButtonStyle.Primary
        )
    );
}

async function updateSupportTicketPanel() {
  const channel =
    await client.channels
      .fetch(
        SUPPORT_TICKETS_CHANNEL
      )
      .catch(() => null);

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    console.error(
      "Support tickets channel could not be found."
    );

    return;
  }

  let message = null;

  if (
    queueData.supportPanelMessageId
  ) {
    message =
      await channel.messages
        .fetch(
          queueData
            .supportPanelMessageId
        )
        .catch(() => null);
  }

  if (message) {
    await message.edit({
      embeds: [
        supportTicketEmbed()
      ],
      components: [
        supportTicketButtons()
      ]
    });

    return;
  }

  const sent =
    await channel.send({
      embeds: [
        supportTicketEmbed()
      ],
      components: [
        supportTicketButtons()
      ]
    });

  queueData.supportPanelMessageId =
    sent.id;

  saveData();
}

async function createSupportTicket(
  interaction
) {
  const guild =
    interaction.guild;

  const userId =
    interaction.user.id;

  const existingTicketId =
    queueData.supportTickets[
      userId
    ];

  if (existingTicketId) {
    const existingChannel =
      await guild.channels
        .fetch(existingTicketId)
        .catch(() => null);

    if (existingChannel) {
      return interaction.reply({
        content:
          `You already have an open support ticket: ${existingChannel}`,
        flags:
          MessageFlags.Ephemeral
      });
    }

    delete queueData
      .supportTickets[
        userId
      ];

    saveData();
  }

  const safeName =
    interaction.user.username
      .toLowerCase()
      .replace(
        /[^a-z0-9-]/g,
        ""
      )
      .slice(0, 18);

  const ticketChannel =
    await guild.channels.create({
      name:
        `ticket-${safeName || userId}`,
      type:
        ChannelType.GuildText,
      topic:
        `Support ticket opened by ${interaction.user.tag} | Owner:${userId}`,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [
            PermissionFlagsBits.ViewChannel
          ]
        },
        {
          id: userId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: SUPPORT_STAFF_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ]
    });

  queueData.supportTickets[
    userId
  ] = ticketChannel.id;

  saveData();

  const closeRow =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "support_ticket_close"
          )
          .setLabel(
            "Close Ticket"
          )
          .setStyle(
            ButtonStyle.Danger
          )
      );

  const embed =
    new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(
        "Support Ticket"
      )
      .setDescription(
        `${interaction.user}, please explain what you need help with.\n\n` +
        `A member of staff will respond when available.`
      );

  await ticketChannel.send({
    content:
      `${interaction.user} <@&${SUPPORT_STAFF_ROLE_ID}>`,
    embeds: [
      embed
    ],
    components: [
      closeRow
    ],
    allowedMentions: {
      users: [
        userId
      ],
      roles: [
        SUPPORT_STAFF_ROLE_ID
      ]
    }
  });

  return interaction.reply({
    content:
      `Your support ticket has been opened: ${ticketChannel}`,
    flags:
      MessageFlags.Ephemeral
  });
}

function reportStaffEmbed() {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(
      "Report Staff"
    )
    .setDescription(
      `By pressing the button, you can submit a private staff report.\n` +
      `You will be asked which staff member you are reporting, what they did, and when it happened.`
    );
}

function reportStaffButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "report_staff_open"
        )
        .setLabel(
          "Submit Report"
        )
        .setStyle(
          ButtonStyle.Danger
        )
    );
}

async function updateReportStaffPanel() {
  const channel =
    await client.channels
      .fetch(
        REPORT_STAFF_CHANNEL
      )
      .catch(() => null);

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    console.error(
      "Report staff channel could not be found."
    );

    return;
  }

  let message = null;

  if (
    queueData.reportPanelMessageId
  ) {
    message =
      await channel.messages
        .fetch(
          queueData
            .reportPanelMessageId
        )
        .catch(() => null);
  }

  if (message) {
    await message.edit({
      embeds: [
        reportStaffEmbed()
      ],
      components: [
        reportStaffButtons()
      ]
    });

    return;
  }

  const sent =
    await channel.send({
      embeds: [
        reportStaffEmbed()
      ],
      components: [
        reportStaffButtons()
      ]
    });

  queueData.reportPanelMessageId =
    sent.id;

  saveData();
}

function reportStaffModal() {
  const modal =
    new ModalBuilder()
      .setCustomId(
        "report_staff_modal"
      )
      .setTitle(
        "Report Staff"
      );

  const staffInput =
    new TextInputBuilder()
      .setCustomId(
        "reported_staff"
      )
      .setLabel(
        "Which staff member?"
      )
      .setPlaceholder(
        "Username, mention, or staff name"
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMaxLength(100);

  const reasonInput =
    new TextInputBuilder()
      .setCustomId(
        "report_reason"
      )
      .setLabel(
        "What did they do?"
      )
      .setPlaceholder(
        "Describe what happened"
      )
      .setStyle(
        TextInputStyle.Paragraph
      )
      .setRequired(true)
      .setMaxLength(1000);

  const whenInput =
    new TextInputBuilder()
      .setCustomId(
        "report_when"
      )
      .setLabel(
        "When did they do it?"
      )
      .setPlaceholder(
        "Example: Today at 5 PM"
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder()
      .addComponents(
        staffInput
      ),

    new ActionRowBuilder()
      .addComponents(
        reasonInput
      ),

    new ActionRowBuilder()
      .addComponents(
        whenInput
      )
  );

  return modal;
}

function closedQueueEmbed() {
  let lastSession =
    "No previous testing session recorded.";

  if (
    queueData.lastTestingSession
  ) {
    lastSession =
      `<t:${Math.floor(
        queueData.lastTestingSession /
        1000
      )}:f>`;
  }

  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(
      "[1.21.11+] Minecraft Vanilla PvP Community"
    )
    .setDescription(
      `**No Testers Online**\n\n` +
      `No testers for your region are available at this time.\n` +
      `You will be notified when a tester is available.\n` +
      `Check back later!\n\n` +
      `Last testing session: ${lastSession}`
    );
}

function openQueueEmbed() {
  const queueList =
    queueData.queue.length > 0
      ? queueData.queue
          .map(
            (userId, index) =>
              `${index + 1}. <@${userId}>`
          )
          .join("\n")
      : "Nobody is currently in the queue.";

  const testerList =
    queueData.activeTesters.length > 0
      ? queueData.activeTesters
          .map(
            (userId, index) =>
              `${index + 1}. <@${userId}>`
          )
          .join("\n")
      : "No active testers.";

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(
      "Tester(s) Available!"
    )
    .setDescription(
      `The queue updates whenever somebody joins or leaves.\n` +
      `Use the buttons below if you wish to join or leave.\n\n` +
      `**Queue (${queueData.queue.length}/20):**\n` +
      `${queueList}\n\n` +
      `**Active Testers:**\n` +
      `${testerList}`
    );
}

function queueButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "queue_join"
        )
        .setLabel(
          "Join Queue"
        )
        .setStyle(
          ButtonStyle.Primary
        ),

      new ButtonBuilder()
        .setCustomId(
          "queue_leave"
        )
        .setLabel(
          "Leave Queue"
        )
        .setStyle(
          ButtonStyle.Secondary
        )
    );
}

async function updateQueueMessage(ping = null) {
  const channel =
    await getQueueChannel();

  if (!channel) {
    console.error(
      "Queue channel could not be found."
    );

    return;
  }

  let message = null;

  if (
    queueData.queueMessageId
  ) {
    message =
      await channel.messages
        .fetch(
          queueData.queueMessageId
        )
        .catch(() => null);
  }

  const embed =
    queueData.open
      ? openQueueEmbed()
      : closedQueueEmbed();

  const components =
    queueData.open
      ? [
          queueButtons()
        ]
      : [];

  let content = "";

  if (ping === "everyone") {
    content = "@everyone";
  }

  if (ping === "here") {
    content = "@here";
  }

  if (message) {
    await message.edit({
      content,
      embeds: [
        embed
      ],
      components,
      allowedMentions: {
        parse: [
          "everyone"
        ]
      }
    });

    return;
  }

  const sent =
    await channel.send({
      content,
      embeds: [
        embed
      ],
      components,
      allowedMentions: {
        parse: [
          "everyone"
        ]
      }
    });

  queueData.queueMessageId =
    sent.id;

  saveData();
}

async function notifyQueuePositions() {
  const newPositions = {};

  for (
    let index = 0;
    index < queueData.queue.length;
    index++
  ) {
    const userId =
      queueData.queue[index];

    const position =
      index + 1;

    newPositions[userId] =
      position;

    if (
      position > 3
    ) {
      continue;
    }

    const previousPosition =
      queueData.lastPositions[
        userId
      ];

    if (
      previousPosition ===
      position
    ) {
      continue;
    }

    const user =
      await client.users
        .fetch(userId)
        .catch(() => null);

    if (!user) continue;

    const embed =
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(
          "Queue Position Updated"
        )
        .setDescription(
          `Your position in the queue has changed.\n` +
          `You are now **#${position}** in the queue.`
        );

    await user
      .send({
        embeds: [
          embed
        ]
      })
      .catch(() => null);
  }

  queueData.lastPositions =
    newPositions;

  saveData();
}

async function cleanTestingTickets(
  guild
) {
  let changed = false;

  for (
    const [
      channelId,
      ticketData
    ]
    of Object.entries(
      queueData.testingTickets
    )
  ) {
    const channel =
      await guild.channels
        .fetch(channelId)
        .catch(() => null);

    if (!channel) {
      delete queueData
        .testingTickets[
          channelId
        ];

      if (
        queueData
          .autoTestingTicketId ===
        channelId
      ) {
        queueData.autoTestingTicketId =
          null;
      }

      changed = true;
    }
  }

  if (
    queueData.autoTestingTicketId &&
    !queueData.testingTickets[
      queueData.autoTestingTicketId
    ]
  ) {
    queueData.autoTestingTicketId =
      null;

    changed = true;
  }

  if (changed) {
    saveData();
  }
}

function userHasTestingTicket(
  userId
) {
  return Object.values(
    queueData.testingTickets
  ).some(
    ticket =>
      ticket.userId ===
      userId
  );
}

async function buildTestingPermissions(
  guild,
  userId
) {
  const staffRole =
    guild.roles.cache.get(
      STAFF_ROLE_ID
    ) ||
    await guild.roles
      .fetch(STAFF_ROLE_ID)
      .catch(() => null);

  if (!staffRole) {
    return null;
  }

  const qualifyingRoles =
    guild.roles.cache.filter(
      role =>
        role.id !== guild.id &&
        role.position >=
          staffRole.position
    );

  const overwrites = [
    {
      id: guild.id,
      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },
    {
      id: userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels
      ]
    }
  ];

  for (
    const role of
    qualifyingRoles.values()
  ) {
    overwrites.push({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    });
  }

  return overwrites;
}

async function createTestingTicket(
  guild,
  userId,
  type = "pull"
) {
  await cleanTestingTickets(
    guild
  );

  if (
    userHasTestingTicket(
      userId
    )
  ) {
    return null;
  }

  const member =
    await guild.members
      .fetch(userId)
      .catch(() => null);

  if (!member) {
    queueData.queue =
      queueData.queue.filter(
        id => id !== userId
      );

    delete queueData
      .lastPositions[
        userId
      ];

    saveData();

    return null;
  }

  const permissions =
    await buildTestingPermissions(
      guild,
      userId
    );

  if (!permissions) {
    return null;
  }

  const verified =
    queueData.verifiedUsers[
      userId
    ];

  const ign =
    verified?.ign ||
    "Unknown";

  const server =
    verified?.server ||
    "Please Reverify Your Account To Display This.";

  const safeName =
    member.user.username
      .toLowerCase()
      .replace(
        /[^a-z0-9-]/g,
        ""
      )
      .slice(0, 18);

  const ticket =
    await guild.channels.create({
      name:
        `test-${safeName || userId}`,
      type:
        ChannelType.GuildText,
      topic:
        `Testing ticket | Owner:${userId} | Type:${type}`,
      permissionOverwrites:
        permissions
    });

  queueData.queue =
    queueData.queue.filter(
      id => id !== userId
    );

  delete queueData
    .lastPositions[
      userId
    ];

  queueData.testingTickets[
    ticket.id
  ] = {
    userId,
    type,
    createdAt:
      Date.now()
  };

  if (
    type === "auto"
  ) {
    queueData.autoTestingTicketId =
      ticket.id;
  }

  queueData.ticketCooldowns[
    userId
  ] =
    Date.now() +
    ONE_DAY;

  saveData();

  const closeRow =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "testing_ticket_close"
          )
          .setLabel(
            "Close Test"
          )
          .setStyle(
            ButtonStyle.Danger
          )
      );

  const embed =
    new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(
        "Testing Ticket"
      )
      .addFields(
        {
          name:
            "Player",
          value:
            `${member}`,
          inline:
            false
        },
        {
          name:
            "Minecraft Username",
          value:
            ign,
          inline:
            false
        },
        {
          name:
            "Preferred Server / IP",
          value:
            server,
          inline:
            false
        }
      );

  const testerIds =
    queueData.activeTesters.filter(
      id =>
        id !== userId
    );

  const testerMentions =
    testerIds
      .map(
        id =>
          `<@${id}>`
      )
      .join(" ");

  const content =
    testerMentions
      ? `<@${userId}> ${testerMentions}`
      : `<@${userId}>`;

  await ticket.send({
    content,
    embeds: [
      embed
    ],
    components: [
      closeRow
    ],
    allowedMentions: {
      users: [
        userId,
        ...testerIds
      ],
      roles: []
    }
  });

  await updateQueueMessage();
  await notifyQueuePositions();

  return ticket;
}

async function createTestingTicketForNext(
  guild
) {
  if (!queueData.open) {
    return;
  }

  await cleanTestingTickets(
    guild
  );

  if (
    queueData.autoTestingTicketId
  ) {
    const autoTicket =
      await guild.channels
        .fetch(
          queueData
            .autoTestingTicketId
        )
        .catch(() => null);

    if (autoTicket) {
      return;
    }

    queueData.autoTestingTicketId =
      null;

    saveData();
  }

  if (
    queueData.queue.length ===
    0
  ) {
    return;
  }

  if (
    queueData.activeTesters.length ===
    0
  ) {
    return;
  }

  const userId =
    queueData.queue[0];

  if (
    userHasTestingTicket(
      userId
    )
  ) {
    queueData.queue =
      queueData.queue.filter(
        id => id !== userId
      );

    delete queueData
      .lastPositions[
        userId
      ];

    saveData();

    await updateQueueMessage();
    await notifyQueuePositions();

    return createTestingTicketForNext(
      guild
    );
  }

  const cooldown =
    getCooldownRemaining(
      userId
    );

  if (cooldown) {
    queueData.queue =
      queueData.queue.filter(
        id => id !== userId
      );

    delete queueData
      .lastPositions[
        userId
      ];

    saveData();

    await updateQueueMessage();
    await notifyQueuePositions();

    return createTestingTicketForNext(
      guild
    );
  }

  const ticket =
    await createTestingTicket(
      guild,
      userId,
      "auto"
    );

  if (!ticket) {
    queueData.queue =
      queueData.queue.filter(
        id => id !== userId
      );

    delete queueData
      .lastPositions[
        userId
      ];

    saveData();

    await updateQueueMessage();
    await notifyQueuePositions();

    return createTestingTicketForNext(
      guild
    );
  }
}

async function processQueue(
  guild
) {
  await cleanTestingTickets(
    guild
  );

  await notifyQueuePositions();

  if (
    !queueData.autoTestingTicketId
  ) {
    await createTestingTicketForNext(
      guild
    );
  }
}

async function updateTierRole(
  guild,
  userId,
  tier
) {
  const member =
    await guild.members
      .fetch(userId);

  const newRoleId =
    tierRoles[tier];

  if (!newRoleId) {
    throw new Error(
      "Tier role is not configured."
    );
  }

  const oldTierRoles =
    allTierRoleIds.filter(
      roleId =>
        roleId !== newRoleId &&
        member.roles.cache.has(
          roleId
        )
    );

  if (
    oldTierRoles.length > 0
  ) {
    await member.roles.remove(
      oldTierRoles
    );
  }

  if (
    !member.roles.cache.has(
      newRoleId
    )
  ) {
    await member.roles.add(
      newRoleId
    );
  }
}

const resultCommand =
  new SlashCommandBuilder()
    .setName("result")
    .setDescription(
      "Post a player's tier result"
    )
    .addUserOption(
      option =>
        option
          .setName("user")
          .setDescription(
            "Player receiving the result"
          )
          .setRequired(true)
    )
    .addStringOption(
      option =>
        option
          .setName("username")
          .setDescription(
            "Player's Minecraft username"
          )
          .setRequired(true)
    )
    .addStringOption(
      option =>
        option
          .setName("region")
          .setDescription(
            "Player region"
          )
          .setRequired(true)
          .addChoices(
            {
              name: "EU",
              value: "EU"
            },
            {
              name: "NA",
              value: "NA"
            },
            {
              name: "AS",
              value: "AS"
            },
            {
              name: "AU",
              value: "AU"
            }
          )
    )
    .addStringOption(
      option =>
        option
          .setName(
            "previous_rank"
          )
          .setDescription(
            "Player's previous rank"
          )
          .setRequired(true)
          .addChoices(
            ...tierChoices
          )
    )
    .addStringOption(
      option =>
        option
          .setName("tier")
          .setDescription(
            "Rank earned"
          )
          .setRequired(true)
          .addChoices(
            ...tierChoices
          )
    )
    .addStringOption(
      option =>
        option
          .setName("gamemode")
          .setDescription(
            "Gamemode"
          )
          .setRequired(true)
          .addChoices(
            {
              name: "Sword",
              value: "Sword"
            },
            {
              name: "Axe",
              value: "Axe"
            },
            {
              name: "Mace",
              value: "Mace"
            },
            {
              name: "Vanilla",
              value: "Vanilla"
            },
            {
              name: "UHC",
              value: "UHC"
            },
            {
              name: "Pot",
              value: "Pot"
            },
            {
              name: "NethOP",
              value: "NethOP"
            },
            {
              name: "SMP",
              value: "SMP"
            }
          )
    );

const unverifyCommand =
  new SlashCommandBuilder()
    .setName("unverify")
    .setDescription("Remove a user's Minecraft verification")
    .addUserOption(
      option =>
        option
          .setName("user")
          .setDescription("The Discord user to unverify")
          .setRequired(true)
    );

const openQueueCommand =
  new SlashCommandBuilder()
    .setName("openqueue")
    .setDescription(
      "Open the testing queue"
    );

const closeQueueCommand =
  new SlashCommandBuilder()
    .setName("closequeue")
    .setDescription(
      "Close the testing queue"
    );

const sendCommand =
  new SlashCommandBuilder()
    .setName("send")
    .setDescription(
      "Send a custom message as the bot"
    );

const punishCommand =
  new SlashCommandBuilder()
    .setName("punish")
    .setDescription(
      "Post a punishment"
    )
.addStringOption(
  option =>
    option
      .setName("user")
      .setDescription(
        "Discord mention or user ID"
      )
      .setRequired(true)
      .setMaxLength(30)
)
    .addStringOption(
      option =>
        option
          .setName("ign")
          .setDescription(
            "Minecraft username"
          )
          .setRequired(true)
          .setMinLength(3)
          .setMaxLength(16)
    )
    .addStringOption(
      option =>
        option
          .setName("reason")
          .setDescription(
            "Reason for the punishment"
          )
          .setRequired(true)
          .setMaxLength(500)
    );

const joinTesterCommand =
  new SlashCommandBuilder()
    .setName("joinastester")
    .setDescription(
      "Join the active tester list"
    );

const leaveTesterCommand =
  new SlashCommandBuilder()
    .setName("leaveastester")
    .setDescription(
      "Leave the active tester list"
    );

const pullCommand =
  new SlashCommandBuilder()
    .setName("pull")
    .setDescription(
      "Immediately pull a player from the queue"
    )
    .addUserOption(
      option =>
        option
          .setName("user")
          .setDescription(
            "Player to pull from the queue"
          )
          .setRequired(true)
    );

client.once(
  Events.ClientReady,
  async readyClient => {
    console.log(
      `Bot online as ${readyClient.user.tag}`
    );

    const rest =
      new REST({
        version: "10"
      }).setToken(token);

    try {
      await rest.put(
        Routes
          .applicationGuildCommands(
            readyClient.user.id,
            GUILD_ID
          ),
        {
          body: [
            resultCommand.toJSON(),
            openQueueCommand.toJSON(),
            closeQueueCommand.toJSON(),
            joinTesterCommand.toJSON(),
            leaveTesterCommand.toJSON(),
            pullCommand.toJSON(),
            punishCommand.toJSON(),
            sendCommand.toJSON(),
            unverifyCommand.toJSON()
          ]
        }
      );

      console.log(
        "Commands registered"
      );
    } catch (error) {
      console.error(
        "Command registration error:",
        error
      );
    }

    try {
      await updateRequestTestPanel();
      await updateQueueMessage();
      await updateSupportTicketPanel();
      await updateReportStaffPanel();

      const guild =
        await client.guilds
          .fetch(GUILD_ID)
          .catch(() => null);

      if (guild) {
        await cleanTestingTickets(
          guild
        );

        if (
          queueData.open
        ) {
          await processQueue(
            guild
          );
        }
      }
    } catch (error) {
      console.error(
        "Panel setup error:",
        error
      );
    }
  }
);

client.on(
  Events.InteractionCreate,
  async interaction => {
    try {
      if (
        interaction.isButton() &&
        interaction.customId ===
          "verify_account"
      ) {
        const existing =
          queueData.verifiedUsers[
            interaction.user.id
          ];

        if (
          existing?.ign &&
          existing?.uuid
        ) {
          return interaction.reply({
            content:
              `You are already verified as **${existing.ign}**.`,
            flags:
              MessageFlags.Ephemeral
          });
        }

        const code =
          createVerificationCode(
            interaction.user.id
          );

        const expiresAt =
          Math.floor(
            (
              Date.now() +
              VERIFY_CODE_LIFETIME
            ) /
            1000
          );

        return interaction.reply({
          content:
            `Join **verify.leaftierlist.co.uk** and run:\n\n` +
            `\`/verify ${code}\`\n\n` +
            `This code expires <t:${expiresAt}:R>.`,
          flags:
            MessageFlags.Ephemeral
        });
      }
        
if (
  interaction.isChatInputCommand() &&
  interaction.commandName === "unverify"
) {
  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    )
  ) {
    return interaction.reply({
      content:
        "Only administrators can use this command.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  const user =
    interaction.options.getUser(
      "user",
      true
    );

  const verification =
    queueData.verifiedUsers[
      user.id
    ];

  if (!verification) {
    return interaction.reply({
      content:
        `${user} is not currently verified.`,
      flags:
        MessageFlags.Ephemeral
    });
  }

  delete queueData.verifiedUsers[
    user.id
  ];

  for (
    const [code, data]
    of Object.entries(
      queueData.pendingVerifications
    )
  ) {
    if (
      data?.userId === user.id
    ) {
      delete queueData
        .pendingVerifications[
          code
        ];
    }
  }

  saveData();

  return interaction.reply({
    content:
      `${user} has been unverified. They must verify their Minecraft account again.`,
    flags:
      MessageFlags.Ephemeral
  });
}

      if (
        interaction.isButton() &&
        interaction.customId ===
          "enter_waitlist"
      ) {
        const verification =
          queueData.verifiedUsers[
            interaction.user.id
          ];

        if (
          !verification ||
          !verification.ign ||
          !verification.uuid
        ) {
          return interaction.reply({
            content:
              "Verify your Minecraft account in-game before entering the waitlist.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const member =
          await interaction.guild
            .members.fetch(
              interaction.user.id
            );

        if (
          member.roles.cache.has(
            WAITLIST_ROLE_ID
          )
        ) {
          return interaction.reply({
            content:
              "You are already in the testing waitlist.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          !verification.server
        ) {
          return interaction.showModal(
            preferredServerModal()
          );
        }

        await member.roles.add(
          WAITLIST_ROLE_ID
        );

        return interaction.reply({
          content:
            `You have entered the testing waitlist as **${verification.ign}**.`,
          flags:
            MessageFlags.Ephemeral
        });
      }

      if (
        interaction.isModalSubmit() &&
        interaction.customId ===
          "preferred_server_modal"
      ) {
        const verification =
          queueData.verifiedUsers[
            interaction.user.id
          ];

        if (
          !verification ||
          !verification.ign ||
          !verification.uuid
        ) {
          return interaction.reply({
            content:
              "Verify your Minecraft account in-game first.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const server =
          interaction.fields
            .getTextInputValue(
              "preferred_server"
            )
            .trim();

        queueData.verifiedUsers[
          interaction.user.id
        ] = {
          ...verification,
          server
        };

        saveData();

        const member =
          await interaction.guild
            .members.fetch(
              interaction.user.id
            );

        if (
          !member.roles.cache.has(
            WAITLIST_ROLE_ID
          )
        ) {
          await member.roles.add(
            WAITLIST_ROLE_ID
          );
        }

        return interaction.reply({
          content:
            `You have entered the testing waitlist as **${verification.ign}**.`,
          flags:
            MessageFlags.Ephemeral
        });
      }

      if (
        interaction.isButton() &&
        interaction.customId ===
          "support_ticket_open"
      ) {
        return createSupportTicket(
          interaction
        );
      }

      if (
        interaction.isButton() &&
        interaction.customId ===
          "support_ticket_close"
      ) {
        const ownerMatch =
          interaction.channel.topic
            ?.match(
              /Owner:(\d+)/
            );

        if (!ownerMatch) {
          return interaction.reply({
            content:
              "This is not a valid support ticket.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const ownerId =
          ownerMatch[1];

        const member =
          await interaction.guild
            .members.fetch(
              interaction.user.id
            );

        const canClose =
          member.roles.cache.has(
            SUPPORT_STAFF_ROLE_ID
          ) ||
          member.permissions.has(
            PermissionFlagsBits.Administrator
          );

        if (!canClose) {
          return interaction.reply({
            content:
              "You cannot close this ticket.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        delete queueData
          .supportTickets[
            ownerId
          ];

        saveData();

        await interaction.reply({
          content:
            "Closing ticket."
        });

        setTimeout(
          async () => {
            await interaction.channel
              .delete()
              .catch(() => null);
          },
          1000
        );

        return;
      }

      if (
        interaction.isButton() &&
        interaction.customId ===
          "testing_ticket_close"
      ) {
        const allowed =
          await isStaffOrAbove(
            interaction.guild,
            interaction.user.id
          );

        if (!allowed) {
          return interaction.reply({
            content:
              "You do not have permission to close this testing ticket.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const channelId =
          interaction.channel.id;

        const savedTicket =
          queueData.testingTickets[
            channelId
          ];

        const ownerMatch =
          interaction.channel.topic
            ?.match(
              /Owner:(\d+)/
            );

        const typeMatch =
          interaction.channel.topic
            ?.match(
              /Type:(auto|pull)/
            );

        const ownerId =
          savedTicket?.userId ||
          ownerMatch?.[1] ||
          null;

        let ticketType =
          savedTicket?.type ||
          typeMatch?.[1] ||
          null;

        if (
          !ticketType &&
          queueData
            .autoTestingTicketId ===
          channelId
        ) {
          ticketType = "auto";
        }

        if (!ticketType) {
          ticketType = "pull";
        }

        delete queueData
          .testingTickets[
            channelId
          ];

        if (
          queueData
            .autoTestingTicketId ===
          channelId
        ) {
          queueData.autoTestingTicketId =
            null;

          ticketType = "auto";
        }

        saveData();

        await interaction.reply({
          content:
            "Closing test."
        });

        const guild =
          interaction.guild;

        setTimeout(
          async () => {
            await interaction.channel
              .delete()
              .catch(() => null);

            if (
              ticketType === "auto"
            ) {
              queueData
                .autoTestingTicketId =
                null;

              saveData();

              await processQueue(
                guild
              );
            } else {
              await cleanTestingTickets(
                guild
              );

              await updateQueueMessage();
            }
          },
          1000
        );

        return;
      }

      if (
        interaction.isButton() &&
        interaction.customId ===
          "report_staff_open"
      ) {
        return interaction.showModal(
          reportStaffModal()
        );
      }

      if (
        interaction.isModalSubmit() &&
        interaction.customId ===
          "report_staff_modal"
      ) {
        const reportedStaff =
          interaction.fields
            .getTextInputValue(
              "reported_staff"
            )
            .trim();

        const reason =
          interaction.fields
            .getTextInputValue(
              "report_reason"
            )
            .trim();

        const when =
          interaction.fields
            .getTextInputValue(
              "report_when"
            )
            .trim();

        const logChannel =
          await client.channels
            .fetch(
              REPORT_LOG_CHANNEL
            )
            .catch(() => null);

        if (
          !logChannel ||
          !logChannel.isTextBased()
        ) {
          return interaction.reply({
            content:
              "The report could not be submitted right now.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const reportEmbed =
          new EmbedBuilder()
            .setColor(
              0xed4245
            )
            .setTitle(
              "Staff Report"
            )
            .addFields(
              {
                name:
                  "Reported Staff",
                value:
                  reportedStaff,
                inline:
                  false
              },
              {
                name:
                  "What Happened",
                value:
                  reason,
                inline:
                  false
              },
              {
                name:
                  "When",
                value:
                  when,
                inline:
                  false
              },
              {
                name:
                  "Reported By",
                value:
                  `${interaction.user}\n${interaction.user.tag}\n${interaction.user.id}`,
                inline:
                  false
              }
            )
            .setTimestamp();

        await logChannel.send({
          embeds: [
            reportEmbed
          ],
          allowedMentions: {
            parse: []
          }
        });

        return interaction.reply({
          content:
            "Your staff report has been submitted.",
          flags:
            MessageFlags.Ephemeral
        });
      }

      if (
        interaction.isButton() &&
        (
          interaction.customId ===
            "queue_join" ||
          interaction.customId ===
            "queue_leave"
        )
      ) {
        if (
          !queueData.open
        ) {
          return interaction.reply({
            content:
              "The queue is currently closed.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const member =
          await interaction.guild
            .members.fetch(
              interaction.user.id
            );

        const userId =
          interaction.user.id;

        if (
          interaction.customId ===
            "queue_join"
        ) {
          if (
            !member.roles.cache.has(
              WAITLIST_ROLE_ID
            )
          ) {
            return interaction.reply({
              content:
                "Enter the testing waitlist before joining the queue.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            !queueData
              .verifiedUsers[
                userId
              ]
          ) {
            return interaction.reply({
              content:
                "Verify your account before joining the queue.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          const cooldown =
            getCooldownRemaining(
              userId
            );

          if (cooldown) {
            const timestamp =
              Math.floor(
                cooldown /
                1000
              );

            return interaction.reply({
              content:
                `You cannot join the queue again until <t:${timestamp}:F> (<t:${timestamp}:R>).`,
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            userHasTestingTicket(
              userId
            )
          ) {
            return interaction.reply({
              content:
                "You already have a testing ticket open.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            queueData.queue.includes(
              userId
            )
          ) {
            return interaction.reply({
              content:
                "You are already in the queue.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            queueData.queue.length >=
            20
          ) {
            return interaction.reply({
              content:
                "The queue is currently full.",
              flags:
                MessageFlags.Ephemeral
            });
          }

          queueData.queue.push(
            userId
          );

          saveData();

          await interaction.reply({
            content:
              `You joined the queue at position #${queueData.queue.length}.`,
            flags:
              MessageFlags.Ephemeral
          });

          await processQueue(
            interaction.guild
          );

          return;
        }

        const index =
          queueData.queue.indexOf(
            userId
          );

        if (
          index === -1
        ) {
          return interaction.reply({
            content:
              "You are not currently in the queue.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        queueData.queue.splice(
          index,
          1
        );

        delete queueData
          .lastPositions[
            userId
          ];

        saveData();

        await interaction.reply({
          content:
            "You have left the queue.",
          flags:
            MessageFlags.Ephemeral
        });

        await updateQueueMessage();
        await notifyQueuePositions();

        return;
      }
        
if (
  interaction.isModalSubmit() &&
  interaction.customId ===
    "send_message_modal"
) {
  const allowed =
    await isStaffOrAbove(
      interaction.guild,
      interaction.user.id
    );

  if (!allowed) {
    return interaction.reply({
      content:
        "You do not have permission to use this.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  const message =
    interaction.fields
      .getTextInputValue(
        "send_message_content"
      );

const chunks =
  message.match(/[\s\S]{1,2000}/g) || [];

for (const chunk of chunks) {
  await interaction.channel.send({
    content: chunk,
    allowedMentions: {
      parse: [
        "users",
        "roles",
        "everyone"
      ]
    }
  });
}

  return interaction.reply({
    content:
      "Message sent.",
    flags:
      MessageFlags.Ephemeral
  });
}

      if (
        !interaction
          .isChatInputCommand()
      ) {
        return;
      }

      if (
        interaction.guildId !==
        GUILD_ID
      ) {
        return interaction.reply({
          content:
            "This command can only be used in the configured server.",
          flags:
            MessageFlags.Ephemeral
        });
      }
        
if (
  interaction.commandName ===
    "send"
) {
  const allowed =
    await isStaffOrAbove(
      interaction.guild,
      interaction.user.id
    );

  if (!allowed) {
    return interaction.reply({
      content:
        "You do not have permission to use this command.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  return interaction.showModal(
    sendMessageModal()
  );
}
        
if (
  interaction.commandName ===
    "punish"
) {
  const allowed =
    await isStaffOrAbove(
      interaction.guild,
      interaction.user.id
    );

  if (!allowed) {
    return interaction.reply({
      content:
        "You do not have permission to use this command.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  const userInput =
    interaction.options
      .getString(
        "user",
        true
      )
      .trim();

  const userIdMatch =
    userInput.match(
      /^<@!?(\d+)>$/
    ) ||
    userInput.match(
      /^(\d+)$/
    );

  if (!userIdMatch) {
    return interaction.reply({
      content:
        "Enter a valid Discord mention or user ID.",
      flags:
        MessageFlags.Ephemeral
    });
  }

  const userId =
    userIdMatch[1];

  const userMention =
    `<@${userId}>`;

  const ign =
    interaction.options
      .getString(
        "ign",
        true
      )
      .trim();

  const reason =
    interaction.options
      .getString(
        "reason",
        true
      )
      .trim();

  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral
  });

  let uuid;

  try {
    uuid =
      await getNameMcUuid(
        ign
      );
  } catch (error) {
    console.error(
      "Minecraft UUID lookup error:",
      error
    );

    uuid = null;
  }

  if (!uuid) {
    return interaction.editReply({
      content:
        `Could not find a Minecraft profile for **${ign}**.`
    });
  }

  await interaction.channel.send({
    content:
      `${userMention} - ${ign} - Restricted for **${reason}**\n\n` +
      `${ign} - \`${uuid}\``,
    allowedMentions: {
      users: [
        userId
      ],
      roles: []
    }
  });

  return interaction.editReply({
    content:
      "Punishment sent."
  });
}

      if (
        interaction.commandName ===
          "openqueue"
      ) {
        const allowed =
          await isStaffOrAbove(
            interaction.guild,
            interaction.user.id
          );

        if (!allowed) {
          return interaction.reply({
            content:
              "You do not have permission to use this command.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          queueData.open
        ) {
          return interaction.reply({
            content:
              "The queue is already open.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        queueData.open =
          true;

        queueData.queue =
          [];

        queueData.lastPositions =
          {};

        queueData.activeTesters =
          [];

        saveData();

        await updateQueueMessage(
          "everyone"
        );

        return interaction.reply({
          content:
            "Queue opened.",
          flags:
            MessageFlags.Ephemeral
        });
      }

      if (
        interaction.commandName ===
          "closequeue"
      ) {
        const allowed =
          await isStaffOrAbove(
            interaction.guild,
            interaction.user.id
          );

        if (!allowed) {
          return interaction.reply({
            content:
              "You do not have permission to use this command.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        queueData.open =
          false;

        queueData.lastTestingSession =
          Date.now();

        queueData.queue =
          [];

        queueData.lastPositions =
          {};

        queueData.activeTesters =
          [];

        for (
          const channelId of
          Object.keys(
            queueData.testingTickets
          )
        ) {
          const ticket =
            await interaction.guild
              .channels.fetch(
                channelId
              )
              .catch(() => null);

          if (ticket) {
            await ticket
              .delete()
              .catch(() => null);
          }
        }

        queueData.testingTickets =
          {};

        queueData.autoTestingTicketId =
          null;

        saveData();

        await updateQueueMessage();

        return interaction.reply({
          content:
            "Queue closed.",
          flags:
            MessageFlags.Ephemeral
        });
      }

      if (
        interaction.commandName ===
          "joinastester"
      ) {
        const allowed =
          await isStaffOrAbove(
            interaction.guild,
            interaction.user.id
          );

        if (!allowed) {
          return interaction.reply({
            content:
              "You do not have permission to join as a tester.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          !queueData.open
        ) {
          return interaction.reply({
            content:
              "The queue is currently closed.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          queueData
            .activeTesters
            .includes(
              interaction.user.id
            )
        ) {
          return interaction.reply({
            content:
              "You are already listed as an active tester.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        queueData.activeTesters.push(
          interaction.user.id
        );

        saveData();

        await updateQueueMessage(
          "here"
        );

        await processQueue(
          interaction.guild
        );

        return interaction.reply({
          content:
            "You joined the active tester list.",
          flags:
            MessageFlags.Ephemeral
        });
      }

      if (
        interaction.commandName ===
          "leaveastester"
      ) {
        const allowed =
          await isStaffOrAbove(
            interaction.guild,
            interaction.user.id
          );

        if (!allowed) {
          return interaction.reply({
            content:
              "You do not have permission to use this command.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const index =
          queueData
            .activeTesters
            .indexOf(
              interaction.user.id
            );

        if (
          index === -1
        ) {
          return interaction.reply({
            content:
              "You are not currently listed as an active tester.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        queueData.activeTesters.splice(
          index,
          1
        );

        saveData();

        await updateQueueMessage();

        return interaction.reply({
          content:
            "You left the active tester list.",
          flags:
            MessageFlags.Ephemeral
        });
      }

      if (
        interaction.commandName ===
          "pull"
      ) {
        const allowed =
          await isStaffOrAbove(
            interaction.guild,
            interaction.user.id
          );

        if (!allowed) {
          return interaction.reply({
            content:
              "You do not have permission to use this command.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        if (
          !queueData.open
        ) {
          return interaction.reply({
            content:
              "The queue is currently closed.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const user =
          interaction.options
            .getUser(
              "user"
            );

        if (
          !queueData.queue.includes(
            user.id
          )
        ) {
          return interaction.reply({
            content:
              "That player is not currently in the queue.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        await cleanTestingTickets(
          interaction.guild
        );

        if (
          userHasTestingTicket(
            user.id
          )
        ) {
          return interaction.reply({
            content:
              "That player already has a testing ticket.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        queueData.queue =
          queueData.queue.filter(
            id =>
              id !== user.id
          );

        delete queueData
          .lastPositions[
            user.id
          ];

        saveData();

        await interaction.reply({
          content:
            `${user} has been pulled for testing.`,
          flags:
            MessageFlags.Ephemeral
        });

        const ticket =
          await createTestingTicket(
            interaction.guild,
            user.id,
            "pull"
          );

        if (!ticket) {
          await updateQueueMessage();
          await notifyQueuePositions();
        }

        return;
      }

      if (
        interaction.commandName ===
          "result"
      ) {
        const allowed =
          await isStaffOrAbove(
            interaction.guild,
            interaction.user.id
          );

        if (!allowed) {
          return interaction.reply({
            content:
              "You do not have permission to use this command.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        const user =
          interaction.options
            .getUser(
              "user"
            );

        const username =
          interaction.options
            .getString(
              "username"
            );

        const region =
          interaction.options
            .getString(
              "region"
            );

        const previousRank =
          interaction.options
            .getString(
              "previous_rank"
            );

        const tier =
          interaction.options
            .getString(
              "tier"
            );

        const gamemode =
          interaction.options
            .getString(
              "gamemode"
            );

        await updateTierRole(
          interaction.guild,
          user.id,
          tier
        );

        try {
          const points = pointsForTier(tier);
          
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
            console.log(`Updated ${username} on website to ${tier}`);
          } else {
            console.error(`Failed to update website: ${websiteResult.error}`);
          }
        } catch (error) {
          console.error('Error updating website:', error);
        }

        const isHighResult =
          HIGH_TIERS.includes(
            tier
          );

        const targetChannelId =
          isHighResult
            ? HIGH_RESULTS_CHANNEL
            : RESULTS_CHANNEL;

        const channel =
          await client.channels
            .fetch(
              targetChannelId
            )
            .catch(() => null);

        if (
          !channel ||
          !channel.isTextBased()
        ) {
          throw new Error(
            "Results channel could not be found."
          );
        }

        const embed =
          new EmbedBuilder()
            .setColor(
              isHighResult
                ? 0xff4500
                : 0xff0000
            )
            .setTitle(
              isHighResult
                ? `${username}'s High Results`
                : `${username}'s Test Results`
            )
            .setThumbnail(
              user.displayAvatarURL({
                size: 256
              })
            )
            .addFields(
              {
                name:
                  "Tester:",
                value:
                  `${interaction.user}`,
                inline:
                  false
              },
              {
                name:
                  "Region:",
                value:
                  region,
                inline:
                  false
              },
              {
                name:
                  "Username:",
                value:
                  username,
                inline:
                  false
              },
              {
                name:
                  "Previous Rank:",
                value:
                  tierNames[
                    previousRank
                  ],
                inline:
                  false
              },
              {
                name:
                  "Rank Earned:",
                value:
                  tierNames[
                    tier
                  ],
                inline:
                  false
              }
            );

        const resultMessage =
          await channel.send({
            content:
              `${user}`,
            embeds: [
              embed
            ]
          });

        if (
          isHighResult
        ) {
          await resultMessage.react(
            "🔥"
          );
        } else {
          await resultMessage.react(
            "👑"
          );

          await resultMessage.react(
            "🥳"
          );

          await resultMessage.react(
            "😱"
          );

          await resultMessage.react(
            "😭"
          );

          await resultMessage.react(
            "😂"
          );

          await resultMessage.react(
            "💀"
          );
        }

        return interaction.reply({
          content:
            "Result posted.",
          flags:
            MessageFlags.Ephemeral
        });
      }
    } catch (error) {
      console.error(
        "Interaction error:",
        error
      );

      if (
        interaction.isRepliable() &&
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction.reply({
          content:
            "Something went wrong while processing that.",
          flags:
            MessageFlags.Ephemeral
        }).catch(() => null);
      }
    }
  }
);

const verificationServer =
  http.createServer(
    (req, res) => {
      if (
        req.method !== "POST" ||
        req.url !==
          "/verify/minecraft"
      ) {
        res.writeHead(
          404,
          {
            "Content-Type":
              "application/json"
          }
        );

        return res.end(
          JSON.stringify({
            error: "Not found"
          })
        );
      }

      const authorization =
        req.headers.authorization;

      if (
        !VERIFY_SECRET ||
        authorization !==
          `Bearer ${VERIFY_SECRET}`
      ) {
        res.writeHead(
          401,
          {
            "Content-Type":
              "application/json"
          }
        );

        return res.end(
          JSON.stringify({
            error: "Unauthorized"
          })
        );
      }

      let body = "";
      let tooLarge = false;

      req.on(
        "data",
        chunk => {
          if (tooLarge) {
            return;
          }

          body += chunk;

          if (
            Buffer.byteLength(
              body,
              "utf8"
            ) > 16384
          ) {
            tooLarge = true;

            res.writeHead(
              413,
              {
                "Content-Type":
                  "application/json"
              }
            );

            res.end(
              JSON.stringify({
                error:
                  "Request too large"
              })
            );

            req.destroy();
          }
        }
      );

      req.on(
        "end",
        async () => {
          if (tooLarge) {
            return;
          }

          let data;

          try {
            data =
              JSON.parse(body);
          } catch {
            res.writeHead(
              400,
              {
                "Content-Type":
                  "application/json"
              }
            );

            return res.end(
              JSON.stringify({
                error:
                  "Invalid JSON"
              })
            );
          }

          const code =
            String(
              data.code || ""
            )
              .trim()
              .toUpperCase();

          const username =
            String(
              data.username || ""
            )
              .trim();

          const uuid =
            String(
              data.uuid || ""
            )
              .trim()
              .toLowerCase();

          if (
            !/^LF-[A-F0-9]{8}$/.test(
              code
            ) ||
            !/^[A-Za-z0-9_]{3,16}$/.test(
              username
            ) ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
              uuid
            )
          ) {
            res.writeHead(
              400,
              {
                "Content-Type":
                  "application/json"
              }
            );

            return res.end(
              JSON.stringify({
                error:
                  "Invalid verification data"
              })
            );
          }

          const pending =
            findVerificationByCode(
              code
            );

          if (!pending) {
            res.writeHead(
              404,
              {
                "Content-Type":
                  "application/json"
              }
            );

            return res.end(
              JSON.stringify({
                error:
                  "Code not found or expired"
              })
            );
          }

          const existing =
            queueData.verifiedUsers[
              pending.userId
            ];

          queueData.verifiedUsers[
            pending.userId
          ] = {
            ign: username,
            uuid,
            server:
              existing?.server ||
              null,
            verifiedAt:
              Date.now()
          };

          delete queueData
            .pendingVerifications[
              code
            ];

          saveData();

          const discordUser =
            await client.users
              .fetch(
                pending.userId
              )
              .catch(() => null);

          if (discordUser) {
            await discordUser
              .send(
                `Your Minecraft account has been verified as **${username}**. You can now return to the server and press **Enter Waitlist**.`
              )
              .catch(() => null);
          }

          res.writeHead(
            200,
            {
              "Content-Type":
                "application/json"
            }
          );

          return res.end(
            JSON.stringify({
              success: true,
              username,
              uuid
            })
          );
        }
      );

      req.on(
        "error",
        error => {
          console.error(
            "Verification request error:",
            error
          );
        }
      );
    }
  );

if (!VERIFY_SECRET) {
  console.error(
    "MINECRAFT_VERIFY_SECRET is missing."
  );
} else {
  verificationServer.listen(
    VERIFY_PORT,
    "0.0.0.0",
    () => {
      console.log(
        `Minecraft verification server listening on port ${VERIFY_PORT}`
      );
    }
  );
}

if (!token) {
  console.error(
    "DISCORD_TOKEN is missing."
  );

  process.exit(1);
}

client.login(token);