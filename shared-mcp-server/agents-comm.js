import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// MCP Server for Agent-to-Agent Communication
// Allows CLIENT and ADMIN agents to exchange messages, share context, and coordinate

const messages = []; // In-memory message queue
const agentState = {}; // Shared state for each agent

const server = new Server(
  {
    name: "cardz-agents-communication",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Tool: Send Message
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "send_message") {
    const { from, to, message, context } = args;
    const msg = {
      id: messages.length + 1,
      from,
      to,
      message,
      context: context || null,
      timestamp: new Date().toISOString(),
      read: false
    };
    messages.push(msg);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, messageId: msg.id })
        }
      ]
    };
  }

  if (name === "read_messages") {
    const { agent_name } = args;
    const agentMessages = messages.filter(m => m.to === agent_name && !m.read);
    
    // Mark as read
    agentMessages.forEach(m => m.read = true);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ messages: agentMessages })
        }
      ]
    };
  }

  if (name === "update_agent_state") {
    const { agent_name, state } = args;
    agentState[agent_name] = {
      ...agentState[agent_name],
      ...state,
      lastUpdate: new Date().toISOString()
    };
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true })
        }
      ]
    };
  }

  if (name === "get_agent_state") {
    const { agent_name } = args;
    const state = agentState[agent_name] || null;
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ state })
        }
      ]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// List available tools
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "send_message",
        description: "שליחת הודעה לסוכן אחר (CLIENT או ADMIN)",
        inputSchema: {
          type: "object",
          properties: {
            from: {
              type: "string",
              description: "שם הסוכן השולח (CLIENT/ADMIN)"
            },
            to: {
              type: "string",
              description: "שם הסוכן היעד (CLIENT/ADMIN)"
            },
            message: {
              type: "string",
              description: "תוכן ההודעה"
            },
            context: {
              type: "object",
              description: "קונטקסט נוסף (אופציונלי)"
            }
          },
          required: ["from", "to", "message"]
        }
      },
      {
        name: "read_messages",
        description: "קריאת הודעות שנשלחו אליי",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: {
              type: "string",
              description: "שם הסוכן (CLIENT/ADMIN)"
            }
          },
          required: ["agent_name"]
        }
      },
      {
        name: "update_agent_state",
        description: "עדכון מצב הסוכן (לשיתוף קונטקסט)",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: {
              type: "string",
              description: "שם הסוכן"
            },
            state: {
              type: "object",
              description: "מצב/קונטקסט לשיתוף"
            }
          },
          required: ["agent_name", "state"]
        }
      },
      {
        name: "get_agent_state",
        description: "קריאת מצב של סוכן אחר",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: {
              type: "string",
              description: "שם הסוכן"
            }
          },
          required: ["agent_name"]
        }
      }
    ]
  };
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);

