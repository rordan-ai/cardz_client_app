#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const AGENT_ROLE = 'client';  // קבוע - לא תלוי ב-env

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const server = {
  name: 'agents-communication-client',
  version: '1.0.0',
  tools: [
    {
      name: 'send_message_to_agent',
      description: 'שליחת הודעה לסוכן אחר דרך Supabase',
      inputSchema: {
        type: 'object',
        properties: {
          target_agent: {
            type: 'string',
            enum: ['client', 'admin'],
            description: 'שם הסוכן היעד (client או admin)'
          },
          message_type: {
            type: 'string',
            enum: ['info', 'question', 'answer', 'update', 'error'],
            description: 'סוג ההודעה'
          },
          content: {
            type: 'string',
            description: 'תוכן ההודעה (JSON string או טקסט)'
          }
        },
        required: ['target_agent', 'message_type', 'content']
      }
    },
    {
      name: 'read_messages_from_agent',
      description: 'קריאת הודעות מסוכן אחר',
      inputSchema: {
        type: 'object',
        properties: {
          from_agent: {
            type: 'string',
            enum: ['client', 'admin'],
            description: 'שם הסוכן השולח'
          },
          mark_as_read: {
            type: 'boolean',
            default: false,
            description: 'האם לסמן כנקרא'
          }
        },
        required: ['from_agent']
      }
    },
    {
      name: 'ask_agent',
      description: 'שליחת שאלה וחכייה לתשובה מסוכן אחר',
      inputSchema: {
        type: 'object',
        properties: {
          target_agent: {
            type: 'string',
            enum: ['client', 'admin'],
            description: 'שם הסוכן היעד'
          },
          question: {
            type: 'string',
            description: 'השאלה'
          },
          timeout_seconds: {
            type: 'number',
            default: 300,
            description: 'זמן המתנה מקסימלי לתשובה'
          }
        },
        required: ['target_agent', 'question']
      }
    }
  ]
};

async function handleToolCall(toolName, args) {
  switch (toolName) {
    case 'send_message_to_agent': {
      const { data, error } = await supabase
        .from('agent_messages')
        .insert({
          from_agent: AGENT_ROLE,
          to_agent: args.target_agent,
          message_type: args.message_type,
          content: args.content,
          status: 'sent'
        })
        .select()
        .single();
      
      if (error) {
        return { error: `Failed to send message: ${error.message}` };
      }
      return { success: true, message: data };
    }
    
    case 'read_messages_from_agent': {
      const { data, error } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('from_agent', args.from_agent)
        .eq('to_agent', AGENT_ROLE)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        return { error: `Failed to read messages: ${error.message}` };
      }
      
      if (args.mark_as_read && data.length > 0) {
        const ids = data.map(m => m.id);
        await supabase
          .from('agent_messages')
          .update({ status: 'read' })
          .in('id', ids);
      }
      
      return { messages: data };
    }
    
    case 'ask_agent': {
      const { data: question, error: sendError } = await supabase
        .from('agent_messages')
        .insert({
          from_agent: AGENT_ROLE,
          to_agent: args.target_agent,
          message_type: 'question',
          content: args.question,
          status: 'sent'
        })
        .select()
        .single();
      
      if (sendError) {
        return { error: `Failed to send question: ${sendError.message}` };
      }
      
      const timeout = args.timeout_seconds || 300;
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout * 1000) {
        const { data: answers, error: readError } = await supabase
          .from('agent_messages')
          .select('*')
          .eq('from_agent', args.target_agent)
          .eq('to_agent', AGENT_ROLE)
          .eq('message_type', 'answer')
          .gte('created_at', question.created_at)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (answers && answers.length > 0) {
          return { answer: answers[0] };
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      return { error: 'Timeout: No answer received' };
    }
    
    default:
      return { error: 'Unknown tool' };
  }
}

// MCP Protocol
process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop();
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const request = JSON.parse(line);
      
      if (request.method === 'initialize') {
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: server
          }
        };
        console.log(JSON.stringify(response));
      } else if (request.method === 'tools/list') {
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: { tools: server.tools }
        };
        console.log(JSON.stringify(response));
      } else if (request.method === 'tools/call') {
        const result = await handleToolCall(request.params.name, request.params.arguments);
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: { content: [{ type: 'text', text: JSON.stringify(result) }] }
        };
        console.log(JSON.stringify(response));
      }
    } catch (err) {
      console.error('Error:', err);
    }
  }
});





