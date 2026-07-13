const { google } = require('@ai-sdk/google');
const { generateText, tool } = require('ai');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

let isAIEnabled = false;
let model = null;

if (apiKey) {
  try {
    // Note: Vercel AI SDK automatically picks up GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.
    // If we want to set it explicitly, we can do it, but letting it read from env is standard.
    // We can also initialize the provider manually:
    const googleProvider = google; // default google provider instance
    model = google('gemini-1.5-flash');
    isAIEnabled = true;
    console.log('Vercel AI SDK initialized with Google Gemini.');
  } catch (error) {
    console.error('Failed to initialize Vercel AI SDK:', error.message);
  }
} else {
  console.warn(
    'WARNING: GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is missing from environment.\n' +
    'The AI Chat Assistant will run in Simulated/Fallback Mode.'
  );
}

// Define DB Tools
const getInventorySummary = tool({
  description: 'Get inventory stats summary, like counts of assets, categories, locations, and asset status breakdown.',
  parameters: z.object({}),
  execute: async () => {
    try {
      const totalAssets = await prisma.asset.count();
      const statusCounts = await prisma.asset.groupBy({
        by: ['status'],
        _count: true,
      });
      const categories = await prisma.category.count();
      const locations = await prisma.location.count();
      const stockItems = await prisma.stockItem.count();
      const openRepairs = await prisma.repairTicket.count({ where: { status: 'OPEN' } });

      return {
        totalAssets,
        statusBreakdown: statusCounts.reduce((acc, curr) => {
          acc[curr.status] = curr._count;
          return acc;
        }, {}),
        categoriesCount: categories,
        locationsCount: locations,
        totalStockTypes: stockItems,
        activeRepairTicketsCount: openRepairs,
      };
    } catch (error) {
      return { error: `Failed to query summary: ${error.message}` };
    }
  },
});

const searchAssets = tool({
  description: 'Search for IT assets in the database by serial number, asset tag, model, manufacturer, or status.',
  parameters: z.object({
    query: z.string().optional().describe('Text search term (model, manufacturer, serial number, asset tag, etc.)'),
    status: z.enum(['AVAILABLE', 'ASSIGNED', 'REPAIR', 'FAULTY', 'LOST', 'DISPOSED']).optional().describe('Filter by asset status'),
  }),
  execute: async ({ query, status }) => {
    try {
      const where = {};
      if (status) {
        where.status = status;
      }
      if (query) {
        where.OR = [
          { assetTag: { contains: query, mode: 'insensitive' } },
          { serialNumber: { contains: query, mode: 'insensitive' } },
          { model: { contains: query, mode: 'insensitive' } },
          { manufacturer: { contains: query, mode: 'insensitive' } },
        ];
      }

      const assets = await prisma.asset.findMany({
        where,
        take: 10,
        include: {
          category: true,
          location: true,
          assignedTo: {
            select: { name: true, email: true }
          }
        }
      });

      return assets.map(a => ({
        id: a.id,
        assetTag: a.assetTag,
        serialNumber: a.serialNumber,
        model: a.model,
        manufacturer: a.manufacturer,
        category: a.category.name,
        location: a.location ? a.location.name : 'Unknown',
        status: a.status,
        assignedTo: a.assignedTo ? a.assignedTo.name : 'None',
      }));
    } catch (error) {
      return { error: `Failed to query assets: ${error.message}` };
    }
  },
});

const getRepairTickets = tool({
  description: 'Get recent repair tickets, filterable by status.',
  parameters: z.object({
    status: z.enum(['OPEN', 'SENT_TO_VENDOR', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional().describe('Filter repair tickets by status'),
  }),
  execute: async ({ status }) => {
    try {
      const where = status ? { status } : {};
      const tickets = await prisma.repairTicket.findMany({
        where,
        take: 10,
        orderBy: { openedAt: 'desc' },
        include: {
          asset: { select: { assetTag: true, model: true } },
          reportedBy: { select: { name: true } },
        }
      });

      return tickets.map(t => ({
        ticketNo: t.ticketNo,
        assetTag: t.asset.assetTag,
        assetModel: t.asset.model,
        reportedBy: t.reportedBy.name,
        issue: t.issue,
        status: t.status,
        cost: t.cost.toString(),
        openedAt: t.openedAt,
      }));
    } catch (error) {
      return { error: `Failed to query repair tickets: ${error.message}` };
    }
  },
});

const getLicenseInfo = tool({
  description: 'Get software license details including active assignments and seat usage.',
  parameters: z.object({}),
  execute: async () => {
    try {
      const licenses = await prisma.license.findMany({
        include: {
          _count: { select: { assignments: { where: { revokedAt: null } } } }
        }
      });

      return licenses.map(l => ({
        id: l.id,
        name: l.name,
        type: l.type,
        totalSeats: l.totalSeats,
        assignedSeats: l._count.assignments,
        availableSeats: l.totalSeats - l._count.assignments,
        expiryDate: l.expiryDate,
      }));
    } catch (error) {
      return { error: `Failed to query licenses: ${error.message}` };
    }
  },
});

const tools = {
  getInventorySummary,
  searchAssets,
  getRepairTickets,
  getLicenseInfo,
};

/**
 * Handle a chat interaction with the user.
 * Messages is an array of Vercel AI SDK Message objects.
 */
async function chatWithAgent(messages) {
  if (!isAIEnabled) {
    return chatSimulationFallback(messages);
  }

  try {
    const response = await generateText({
      model: model,
      messages,
      system: `You are the Nationwide Paper IT Chat Assistant, a premium AI assistant integrated into the ITSM Inventory Portal.
You have direct access to database tools to fetch real-time information about assets, repairs, software licenses, and stock.
Always query the database tools when asked about numbers, specifics, or search queries.
Be professional, concise, helpful, and friendly. Style responses beautifully in Markdown with bold key values, bullet points, or tables.
If the database doesn't have details, mention that you queried the system and no results were found.`,
      tools,
      maxSteps: 5, // allows tool execution recursion (multi-step tool calls)
    });

    return {
      text: response.text,
      toolCalls: response.toolCalls,
    };
  } catch (error) {
    console.error('Error generating AI response:', error);
    return {
      text: `Error contacting the AI service: ${error.message}. Please verify the GEMINI_API_KEY environment variable.`,
      toolCalls: [],
    };
  }
}

/**
 * Fallback chat simulator when GEMINI_API_KEY is not defined.
 */
function chatSimulationFallback(messages) {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const query = lastMessage.toLowerCase();

  let reply = '';
  if (query.includes('summary') || query.includes('how many') || query.includes('status')) {
    reply = `### 🖥️ IT Inventory Summary (Simulated Mode)
    
We are running in **Simulated Fallback Mode** because no \`GEMINI_API_KEY\` is configured. Here is a simulated status overview:

*   **Total Laptops**: 48 (42 Assigned, 4 Available, 2 In Repair)
*   **Total Monitors**: 35 (30 Assigned, 5 Available)
*   **Software Licenses**:
    *   *Microsoft 365 Business Premium*: 50 seats (46 assigned, 4 free)
    *   *Norton Antivirus*: 20 seats (18 assigned, 2 free)
*   **Open Maintenance Tickets**: 3 pending vendor diagnostics.

*To enable live AI queries against your Postgres database, please set the \`GEMINI_API_KEY\` in your \`backend/.env\` file.*`;
  } else if (query.includes('repair') || query.includes('ticket') || query.includes('maintenance')) {
    reply = `### 🔧 Maintenance & Repair Status (Simulated Mode)

Currently tracking **3 open repair tickets** in fallback mode:

1.  **TK-2026-001**: Laptop screen replacement for *John Doe* (Status: **Sent to Vendor**)
2.  **TK-2026-002**: Keyboard malfunction for *Sarah Jenkins* (Status: **In Progress**)
3.  **TK-2026-003**: Battery replacement for *Office Lab PC* (Status: **Open**)

*Configure your \`GEMINI_API_KEY\` in \`backend/.env\` to enable dynamic, real-time database lookups.*`;
  } else {
    reply = `### 👋 Welcome to Nationwide Paper IT Assistant!

I am currently running in **Simulated Fallback Mode** because your \`GEMINI_API_KEY\` env variable is not set.

**Try asking me about:**
1. *"Show me the inventory summary"*
2. *"What is the status of repair tickets?"*

*To activate live database tool-calling and natural language intelligence, please add a valid \`GEMINI_API_KEY\` to your \`backend/.env\` file.*`;
  }

  return {
    text: reply,
    toolCalls: [],
  };
}

module.exports = {
  isAIEnabled,
  chatWithAgent,
};
