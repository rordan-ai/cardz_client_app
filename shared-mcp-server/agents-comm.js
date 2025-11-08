import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from '@supabase/supabase-js';

// Supabase client - משותף לשני הסוכנים
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://noqfwkxzmvpkorcaymcb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcWZ3a3h6bXZwa29yY2F5bWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTgzMTgsImV4cCI6MjA2MDk5NDMxOH0.LNozVpUNhbNR09WGCb79vKgUnrtflG2bEwPKQO7Q1oM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Message Queue Management
const messageQueue = {
  high: [],
  normal: [],
  low: []
};

// Message Status Tracking
const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Smart Retry Configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000
};

// Utility Functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoffDelay(attempt) {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

// Smart Retry Function
async function executeWithRetry(operation, maxRetries = RETRY_CONFIG.maxRetries) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = calculateBackoffDelay(attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

// EXTREME VALIDATION - MAXIMUM ENFORCEMENT
function validateMessageBeforeSend(from, to, message) {
  const validationChecks = {
    completedAllChecks: false,
    displayedToUser: false,
    errors: [],
    warnings: [],
    severity: 'CRITICAL'
  };

  // ULTRA STRICT Check 1: דוח מסכם - בדיקה מרובת שכבות
  const summaryKeywords = ['דוח מסכם', 'סיכום', 'מסקנה', 'דוח סופי', 'סיום', 'הושלם', 'בוצע', 'הסתיים'];
  const hasSummaryKeyword = summaryKeywords.some(keyword => message.includes(keyword));
  
  // בדיקה נוספת - ההודעה חייבת להתחיל עם דוח מסכם או לכלול אותו בתחילת המשפט
  const startsWithSummary = message.trim().startsWith('דוח מסכם:') || 
                           message.includes('סיכום:') || 
                           message.includes('מסקנה:');
  
  if (!hasSummaryKeyword || !startsWithSummary) {
    validationChecks.errors.push('🚨 CRITICAL: ההודעה חייבת להתחיל ב"דוח מסכם:" או "סיכום:"');
    validationChecks.errors.push('🚫 לא מספיק רק לכלול את המילה - חייב להתחיל עם זה!');
    validationChecks.errors.push('❌ שגוי: "המשימה הושלמה - דוח מסכם"');
    validationChecks.errors.push('✅ נכון: "דוח מסכם: המשימה הושלמה בהצלחה"');
    validationChecks.errors.push('✅ נכון: "סיכום: כל הבדיקות בוצעו והתוצאות מוכנות"');
  } else {
    validationChecks.completedAllChecks = true;
  }

  // ULTRA STRICT Check 2: הצגה למשתמש - בדיקה מחמירה
  const userDisplayKeywords = ['הצגתי למשתמש', 'דיווחתי למשתמש', 'הסברתי למשתמש', 'הראיתי למשתמש', 'הודעתי למשתמש'];
  const hasUserDisplayKeyword = userDisplayKeywords.some(keyword => message.includes(keyword));
  
  // בדיקה נוספת - חייב להיות בזמן עבר ולא עתיד
  const futureWords = ['אציג', 'אדווח', 'אסביר', 'אראה', 'אודיע'];
  const hasFutureDisplay = futureWords.some(word => message.includes(word));
  
  if (!hasUserDisplayKeyword || hasFutureDisplay) {
    validationChecks.errors.push('🚨 CRITICAL: חייב לציין שכבר הצגת למשתמש (בזמן עבר!)');
    validationChecks.errors.push('🚫 אסור להשתמש בזמן עתיד - רק מה שכבר בוצע!');
    validationChecks.errors.push('❌ שגוי: "אציג למשתמש את התוצאות"');
    validationChecks.errors.push('✅ נכון: "הצגתי למשתמש את כל התוצאות והנתונים"');
  } else {
    validationChecks.displayedToUser = true;
  }

  // Check 3: איסור על מילות עתיד - הוסר לפי בקשת המשתמש
  // const forbiddenFutureWords = ['אתחיל', 'אתחל', 'אעבוד', 'אבדוק', 'אנסה', 'אעשה', 'אבצע', 'אכין', 'איצור', 'אוסיף'];
  // הבדיקה הוסרה

  // Check 4: אורך ותוכן מינימלי - הוסר לפי בקשת המשתמש
  // if (message.length < 30) {
  //   validationChecks.errors.push('🚨 ההודעה קצרה מדי! מינימום 30 תווים עם פרטים מלאים');
  // }

  // EXTREME Check 5: חייב לכלול פרטים על מה שבוצע
  const actionWords = ['יצרתי', 'בניתי', 'הוספתי', 'תיקנתי', 'עדכנתי', 'מחקתי', 'שיניתי', 'בדקתי'];
  const hasActionWords = actionWords.some(word => message.includes(word));
  
  if (!hasActionWords) {
    validationChecks.errors.push('🚨 חסרים פרטים על מה שבוצע!');
    validationChecks.errors.push('💡 הוסף מילים כמו: "יצרתי", "בניתי", "תיקנתי", "עדכנתי"');
  }

  // EXTREME Check 6: בדיקת מבנה ההודעה
  if (!message.includes('.') && !message.includes('!')) {
    validationChecks.errors.push('🚨 ההודעה חייבת להכיל לפחות משפט אחד מלא (עם נקודה או סימן קריאה)');
  }

  return validationChecks;
}

// Event-driven Message Listener
function setupEventListener(agentName) {
  const channel = supabase
    .channel(`agent_${agentName}_messages`)
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'agent_messages',
        filter: `to_agent=eq.${agentName}`
      },
      async (payload) => {
        console.log(`📨 New message for ${agentName}:`, payload.new);
        await processNewMessage(payload.new);
      }
    )
    .subscribe();
    
  return channel;
}

// Process New Message
async function processNewMessage(message) {
  try {
    // Add to appropriate queue based on priority
    const priority = message.context?.priority || 'normal';
    messageQueue[priority].push(message);
    
    // Update status to delivered
    await updateMessageStatus(message.id, MESSAGE_STATUS.DELIVERED);
    
    // AUTOMATIC NOTIFICATION TO USER
    const priorityEmoji = priority === 'high' ? '🚨' : priority === 'normal' ? '📨' : '📝';
    const notification = `${priorityEmoji} הודעה חדשה מ-${message.from_agent}!\n` +
                        `📝 תוכן: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}\n` +
                        `⏰ זמן: ${new Date(message.created_at).toLocaleString('he-IL')}\n` +
                        `🔢 ID: ${message.id}`;
    
    // Display notification to user immediately
    console.log('\n' + '='.repeat(60));
    console.log(notification);
    console.log('='.repeat(60) + '\n');
    
    console.log(`Message ${message.id} added to ${priority} queue`);
  } catch (error) {
    console.error('Error processing new message:', error);
  }
}

// Update Message Status (adapted to existing schema)
async function updateMessageStatus(messageId, status) {
  try {
    await executeWithRetry(async () => {
      const { error } = await supabase
        .from('agent_messages')
        .update({ 
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
        
      if (error) {
        // Fallback - update only existing columns
        const { error2 } = await supabase
          .from('agent_messages')
          .update({ 
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
        if (error2) console.log('Status update not available yet');
      }
    });
  } catch (error) {
    console.error(`Failed to update message ${messageId}:`, error);
  }
}

// Queue Processor
function processMessageQueue() {
  // Process high priority first
  ['high', 'normal', 'low'].forEach(priority => {
    while (messageQueue[priority].length > 0) {
      const message = messageQueue[priority].shift();
      console.log(`Processing ${priority} priority message:`, message.id);
    }
  });
}

// Validation violations tracking
const validationViolations = [];

// Start queue processor
setInterval(processMessageQueue, 5000); // Process queue every 5 seconds

const server = new Server(
  {
    name: "cardz-agents-communication",
    version: "2.0.0",
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
        description: "שליחת הודעה לסוכן אחר (CLIENT או ADMIN) עם בדיקות אוטומטיות",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "שם הסוכן השולח (CLIENT/ADMIN)" },
            to: { type: "string", description: "שם הסוכן היעד (CLIENT/ADMIN)" },
            message: { type: "string", description: "תוכן ההודעה" },
            context: { type: "object", description: "קונטקסט נוסף (אופציונלי)" },
            priority: { type: "string", description: "עדיפות ההודעה (high/normal/low)", "default": "normal" },
            skipValidation: { type: "boolean", description: "דלג על בדיקות אוטומטיות", "default": false }
          },
          required: ["from", "to", "message"]
        }
      },
      {
        name: "read_messages",
        description: "קריאת הודעות שנשלחו אליי (עם Event-driven support)",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string", description: "שם הסוכן (CLIENT/ADMIN)" },
            enableEventListener: { type: "boolean", description: "הפעל האזנה אוטומטית להודעות חדשות", "default": true }
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
      },
      {
        name: "get_message_status",
        description: "בדיקת סטטוס הודעה",
        inputSchema: {
          type: "object",
          properties: {
            messageId: { type: "string", description: "מזהה ההודעה" }
          },
          required: ["messageId"]
        }
      },
      {
        name: "get_queue_status",
        description: "בדיקת מצב תור ההודעות",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string", description: "שם הסוכן" }
          },
          required: ["agent_name"]
        }
      },
      {
        name: "check_new_messages_auto",
        description: "בדיקה אוטומטית של הודעות חדשות עם התראה מיידית למשתמש",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string", description: "שם הסוכן (CLIENT/ADMIN)" },
            showNotification: { type: "boolean", description: "הצג התראה למשתמש", "default": true }
          },
          required: ["agent_name"]
        }
      },
      {
        name: "get_validation_violations",
        description: "דוח על הפרות חוקי הוולידציה - מעקב אחר ניסיונות שליחה לא תקינים",
        inputSchema: {
          type: "object",
          properties: {
            agent_name: { type: "string", description: "שם הסוכן לבדיקה (או 'ALL' לכולם)" },
            timeframe: { type: "string", description: "טווח זמן (last_hour/last_day/all)", "default": "last_hour" }
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
    const { from, to, message, context, priority = 'normal', skipValidation = false } = args;
    
    try {
      // EXTREME VALIDATION - MAXIMUM ENFORCEMENT WITH USER ALERTS
      const validation = validateMessageBeforeSend(from, to, message);
      
      // CRITICAL: Log and alert user about ANY validation attempt
      const timestamp = new Date().toLocaleString('he-IL');
      const alertMessage = `\n${'🚨'.repeat(10)} VALIDATION ALERT ${'🚨'.repeat(10)}\n` +
                          `⏰ זמן: ${timestamp}\n` +
                          `👤 סוכן: ${from}\n` +
                          `📝 הודעה: "${message.substring(0, 150)}${message.length > 150 ? '...' : ''}"\n` +
                          `🚫 שגיאות: ${validation.errors.length}\n` +
                          `⚠️ ניסיון עקיפה: ${skipValidation ? 'כן' : 'לא'}\n` +
                          `${'🚨'.repeat(50)}`;
      
      console.log(alertMessage);
      
      // ABSOLUTE ENFORCEMENT - NO EXCEPTIONS
      if (validation.errors.length > 0) {
        // Record violation for tracking
        const violation = {
          timestamp: new Date().toISOString(),
          agent: from,
          message: message,
          errors: validation.errors,
          bypassAttempt: skipValidation,
          severity: 'CRITICAL'
        };
        validationViolations.push(violation);
        
        // Keep only last 100 violations to prevent memory issues
        if (validationViolations.length > 100) {
          validationViolations.shift();
        }
        
        // Create detailed error response with maximum severity
        const errorMessage = {
          success: false,
          blocked: true,
          severity: 'CRITICAL',
          agent: from,
          timestamp: timestamp,
          validationErrors: validation.errors,
          warnings: validation.warnings || [],
          message: "🚨 CRITICAL: הודעה נחסמה במנגנון האכיפה הקיצוני!",
          userAlert: `🚨 המשתמש: הסוכן ${from} ניסה לשלוח הודעה לא תקינה!`,
          strictInstructions: [
            "🚨 CRITICAL: ההודעה חייבת להתחיל ב'דוח מסכם:' או 'סיכום:'",
            "🚨 CRITICAL: ההודעה חייבת להכיל 'הצגתי למשתמש' (בזמן עבר!)",
            "🚨 STRUCTURE: חייב להכיל לפחות משפט אחד מלא עם נקודה",
            "💀 אין אפשרות לעקוף - המערכת חוסמת הכל!"
          ],
          bypassAttempt: skipValidation,
          enforcementLevel: 'MAXIMUM',
          violationId: validationViolations.length
        };
        
        // Additional user notification
        console.log(`\n🔔 התראה למשתמש: הסוכן ${from} ניסה לשלוח הודעה שלא עומדת בדרישות!`);
        console.log(`📊 סטטיסטיקה: ${validation.errors.length} שגיאות קריטיות זוהו`);
        console.log(`🚫 ההודעה נחסמה לחלוטין`);
        console.log(`📋 מספר הפרה: ${validationViolations.length}\n`);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(errorMessage)
          }]
        };
      }
      
      // Even successful messages get logged for monitoring
      console.log(`✅ הודעה תקינה מ-${from}: "${message.substring(0, 50)}..."`);
      
      // Send message using existing schema
    const { data, error } = await supabase
      .from('agent_messages')
      .insert([{
        from_agent: from,
        to_agent: to,
          message_type: 'info',
          content: message
      }])
      .select()
      .single();
    
      if (error) throw error;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ 
            success: true, 
            messageId: data.id
          })
        }]
      };
    
    } catch (error) {
    return {
      content: [{
        type: "text",
          text: JSON.stringify({ 
            success: false, 
            error: error.message
          })
      }]
    };
    }
  }

  if (name === "read_messages") {
    const { agent_name, enableEventListener = true } = args;
    
    try {
      // Setup event listener if requested
      if (enableEventListener) {
        setupEventListener(agent_name);
      }
    
    const { data, error } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('to_agent', agent_name)
        .order('created_at', { ascending: false })
        .limit(10);
    
      if (error) throw error;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ 
            messages: data || [],
            eventListenerEnabled: enableEventListener
          })
        }]
      };
      
    } catch (error) {
    return {
      content: [{
        type: "text",
          text: JSON.stringify({ 
            messages: [], 
            error: error.message
          })
      }]
    };
    }
  }

  if (name === "update_agent_state") {
    const { agent_name, state } = args;
    
    try {
    const { error } = await supabase
      .from('agent_state')
      .upsert({
        agent_name: agent_name,
        state: state,
        last_update: new Date().toISOString()
      });
    
      if (error) throw error;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true })
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, error: error.message })
        }]
      };
    }
  }

  if (name === "get_agent_state") {
    const { agent_name } = args;
    
    try {
    const { data, error } = await supabase
      .from('agent_state')
      .select('state, last_update')
      .eq('agent_name', agent_name)
      .single();
    
      if (error) throw error;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ state: data })
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ state: null, error: error.message })
        }]
      };
    }
  }
  
  if (name === "get_message_status") {
    const { messageId } = args;
    
    try {
      const { data, error } = await supabase
        .from('agent_messages')
        .select('status, created_at, updated_at')
        .eq('id', messageId)
        .single();
        
      if (error) throw error;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ messageStatus: data })
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ messageStatus: null, error: error.message })
        }]
      };
    }
  }
  
  if (name === "get_queue_status") {
    const { agent_name } = args;
    
    const queueStatus = {
      agent: agent_name,
      queues: {
        high: messageQueue.high.length,
        normal: messageQueue.normal.length,
        low: messageQueue.low.length
      },
      totalPending: messageQueue.high.length + messageQueue.normal.length + messageQueue.low.length,
      lastProcessed: new Date().toISOString()
    };
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ queueStatus })
      }]
    };
  }
  
  if (name === "check_new_messages_auto") {
    const { agent_name, showNotification = true } = args;
    
    try {
      const { data, error } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('to_agent', agent_name)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (error) throw error;
      
      let notificationMessage = '';
      
      if (data && data.length > 0) {
        if (showNotification) {
          notificationMessage = `\n${'🔔'.repeat(3)} יש לך ${data.length} הודעות! ${'🔔'.repeat(3)}\n\n`;
          
          data.forEach((msg, index) => {
            const timeAgo = Math.floor((new Date() - new Date(msg.created_at)) / 60000);
            notificationMessage += `📨 הודעה #${index + 1} מ-${msg.from_agent}:\n`;
            notificationMessage += `   📝 ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}\n`;
            notificationMessage += `   ⏰ לפני ${timeAgo} דקות (ID: ${msg.id})\n\n`;
          });
          
          notificationMessage += '='.repeat(60);
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ 
              hasNewMessages: true,
              messageCount: data.length,
              messages: data,
              notification: notificationMessage
            })
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ 
              hasNewMessages: false,
              messageCount: 0,
              notification: '✅ אין הודעות חדשות'
            })
          }]
        };
      }
      
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ 
            error: error.message,
            notification: '❌ שגיאה בבדיקת הודעות'
          })
        }]
      };
    }
  }
  
  if (name === "get_validation_violations") {
    const { agent_name, timeframe = 'last_hour' } = args;
    
    let filteredViolations = validationViolations;
    
    // Filter by agent
    if (agent_name !== 'ALL') {
      filteredViolations = filteredViolations.filter(v => v.agent === agent_name);
    }
    
    // Create report
    let report = `\n${'🚨'.repeat(15)} דוח הפרות וולידציה ${'🚨'.repeat(15)}\n\n`;
    report += `📊 סטטיסטיקות:\n`;
    report += `   👤 סוכן: ${agent_name}\n`;
    report += `   🚫 סה"כ הפרות: ${filteredViolations.length}\n\n`;
    
    if (filteredViolations.length > 0) {
      report += `📋 פירוט הפרות אחרונות:\n\n`;
      
      filteredViolations.slice(-5).forEach((violation, index) => {
        report += `🚨 הפרה #${index + 1}:\n`;
        report += `   👤 סוכן: ${violation.agent}\n`;
        report += `   📝 הודעה: "${violation.message.substring(0, 80)}..."\n`;
        report += `   🚫 שגיאות: ${violation.errors.length}\n\n`;
      });
    } else {
      report += `✅ לא נמצאו הפרות\n\n`;
    }
    
    report += `${'🚨'.repeat(50)}`;
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          totalViolations: filteredViolations.length,
          violations: filteredViolations.slice(-5),
          report: report
        })
      }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);