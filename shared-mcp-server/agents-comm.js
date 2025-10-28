import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from '@supabase/supabase-js';

// Supabase client - משותף לשני הסוכנים
const SUPABASE_URL = 'https://noqfwkxzmvpkorcaymcb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcWZ3a3h6bXZwa29yY2F5bWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTgzMTgsImV4cCI6MjA2MDk5NDMxOH0.LNozVpUNhbNR09WGCb79vKgUnrtflG2bEwPKQO7Q1oM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const server = new Server(
  {
    name: "cardz-agents-communication",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "send_message",
        description: "שליחת הודעה לסוכן אחר (CLIENT או ADMIN)",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "שם הסוכן השולח (CLIENT/ADMIN)" },
            to: { type: "string", description: "שם הסוכן היעד (CLIENT/ADMIN)" },
            message: { type: "string", description: "תוכן ההודעה" },
            context: { type: "object", description: "קונטקסט נוסף (אופציונלי)" }
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
            agent_name: { type: "string", description: "שם הסוכן (CLIENT/ADMIN)" }
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
            agent_name: { type: "string", description: "שם הסוכן" },
            state: { type: "object", description: "מצב/קונטקסט לשיתוף" }
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
            agent_name: { type: "string", description: "שם הסוכן" }
          },
          required: ["agent_name"]
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "send_message") {
    const { from, to, message, context } = args;
    
    const { data, error } = await supabase
      .from('agent_messages')
      .insert([{
        from_agent: from,
        to_agent: to,
        message: message,
        context: context || {}
      }])
      .select()
      .single();
    
    if (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, error: error.message })
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: true, messageId: data.id })
      }]
    };
  }

  if (name === "read_messages") {
    const { agent_name } = args;
    
    const { data, error } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('to_agent', agent_name)
      .eq('read', false)
      .order('created_at', { ascending: true });
    
    if (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ messages: [], error: error.message })
        }]
      };
    }
    
    // Mark as read
    if (data && data.length > 0) {
      const ids = data.map(m => m.id);
      await supabase
        .from('agent_messages')
        .update({ read: true, read_at: new Date().toISOString() })
        .in('id', ids);
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ messages: data || [] })
      }]
    };
  }

  if (name === "update_agent_state") {
    const { agent_name, state } = args;
    
    const { error } = await supabase
      .from('agent_state')
      .upsert({
        agent_name: agent_name,
        state: state,
        last_update: new Date().toISOString()
      });
    
    if (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, error: error.message })
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: true })
      }]
    };
  }

  if (name === "get_agent_state") {
    const { agent_name } = args;
    
    const { data, error } = await supabase
      .from('agent_state')
      .select('state, last_update')
      .eq('agent_name', agent_name)
      .single();
    
    if (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ state: null, error: error.message })
        }]
      };
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ state: data })
      }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
