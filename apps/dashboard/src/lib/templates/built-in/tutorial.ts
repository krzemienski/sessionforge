import type { BuiltInTemplate } from "@/types/templates";

/**
 * Tutorial Template
 *
 * A step-by-step instructional template for teaching technical concepts,
 * tools, or workflows. Focuses on guiding learners through a hands-on
 * learning experience with clear instructions and examples.
 */
export const tutorialTemplate: BuiltInTemplate = {
  name: "Tutorial",
  slug: "tutorial",
  contentType: "blog_post",
  description:
    "A step-by-step instructional template for teaching how to build, configure, or use something. Perfect for onboarding guides, how-to articles, and hands-on learning content.",
  structure: {
    sections: [
      {
        heading: "Introduction",
        description:
          "Set the context. What will readers learn? What will they build? Why is this useful? Hook them with the end result.",
        required: true,
      },
      {
        heading: "Prerequisites",
        description:
          "List what readers need before starting. Required knowledge, tools, dependencies, and environment setup. Be specific about versions.",
        required: true,
      },
      {
        heading: "What You'll Build",
        description:
          "Show the finished product. Include screenshots, demos, or code examples. Let readers see where they're headed.",
        required: false,
      },
      {
        heading: "Step-by-Step Instructions",
        description:
          "Break down the tutorial into clear, numbered steps. Each step should have a single focus. Include code snippets, commands, and expected output.",
        required: true,
      },
      {
        heading: "How It Works",
        description:
          "Explain the concepts and mechanics behind what they just built. Connect the dots between the steps and the underlying principles.",
        required: false,
      },
      {
        heading: "Troubleshooting",
        description:
          "Address common errors and gotchas. Include solutions to issues readers are likely to encounter.",
        required: false,
      },
      {
        heading: "Next Steps",
        description:
          "Suggest ways to extend or improve what they built. Link to related tutorials or advanced topics. Keep the learning momentum going.",
        required: false,
      },
    ],
  },
  toneGuidance: `Write in second person ("you will build"). Be encouraging and supportive. Assume intelligence but not prior knowledge of this specific topic.

Style: Clear, sequential, and actionable. Each step should be easy to follow and verify.
Voice: Friendly instructor. Patient and enthusiastic. Make learners feel capable.
Length: 1500-3000 words. Long enough to be thorough, concise enough to maintain engagement.

Avoid: Skipping steps, assuming too much knowledge, leaving ambiguity about what to do next, overwhelming with theory before practice.`,
  exampleContent: `# Build a Real-Time Chat App with WebSockets

## Introduction

In this tutorial, you'll build a real-time chat application using WebSockets, Node.js, and vanilla JavaScript. By the end, you'll have a working chat app where multiple users can send messages instantly - no page refreshes required.

This is a great project for learning how real-time communication works in web apps. The concepts you'll learn apply to collaborative tools, live dashboards, multiplayer games, and more.

**Time to complete:** 45 minutes
**Difficulty:** Beginner to Intermediate

## Prerequisites

Before starting, make sure you have:

- **Node.js** installed (v18 or higher). Check with \`node --version\`
- **Basic JavaScript knowledge**: variables, functions, DOM manipulation
- **A code editor**: VS Code, Sublime, or similar
- **A terminal**: For running commands
- **Two browser windows**: To test multi-user chat

No prior WebSocket experience needed - we'll explain everything as we go.

## What You'll Build

By the end of this tutorial, you'll have a chat app that:

- Connects multiple users in real-time
- Broadcasts messages to all connected clients
- Shows when users join and leave
- Displays typing indicators
- Works across browser tabs and devices

\`\`\`
[Screenshot of the finished chat app would go here]
\`\`\`

## Step-by-Step Instructions

### Step 1: Set Up the Project

Create a new directory and initialize a Node.js project:

\`\`\`bash
mkdir websocket-chat
cd websocket-chat
npm init -y
\`\`\`

Install the WebSocket library:

\`\`\`bash
npm install ws
\`\`\`

Your \`package.json\` should now include \`ws\` in dependencies.

### Step 2: Create the WebSocket Server

Create a file called \`server.js\`:

\`\`\`javascript
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

console.log('WebSocket server running on ws://localhost:8080');

server.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('message', (message) => {
    console.log('Received:', message);

    // Broadcast to all connected clients
    server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  socket.on('close', () => {
    console.log('Client disconnected');
  });
});
\`\`\`

**What this does:**
- Creates a WebSocket server on port 8080
- Listens for new client connections
- Receives messages and broadcasts them to all connected clients
- Logs when clients connect and disconnect

Start the server:

\`\`\`bash
node server.js
\`\`\`

You should see: \`WebSocket server running on ws://localhost:8080\`

### Step 3: Create the Client HTML

Create \`index.html\`:

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Chat</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; }
    #messages { border: 1px solid #ccc; height: 300px; overflow-y: scroll; padding: 10px; margin-bottom: 10px; }
    #messageInput { width: 80%; padding: 10px; }
    #sendButton { padding: 10px 20px; }
  </style>
</head>
<body>
  <h1>WebSocket Chat</h1>
  <div id="messages"></div>
  <input id="messageInput" type="text" placeholder="Type a message..." />
  <button id="sendButton">Send</button>
  <script src="client.js"></script>
</body>
</html>
\`\`\`

### Step 4: Create the Client JavaScript

Create \`client.js\`:

\`\`\`javascript
const socket = new WebSocket('ws://localhost:8080');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

socket.onopen = () => {
  console.log('Connected to server');
  addMessage('Connected to chat!', 'system');
};

socket.onmessage = (event) => {
  addMessage(event.data, 'user');
};

socket.onerror = (error) => {
  console.error('WebSocket error:', error);
  addMessage('Connection error', 'system');
};

socket.onclose = () => {
  addMessage('Disconnected from chat', 'system');
};

sendButton.onclick = () => {
  const message = messageInput.value.trim();
  if (message && socket.readyState === WebSocket.OPEN) {
    socket.send(message);
    messageInput.value = '';
  }
};

messageInput.onkeypress = (e) => {
  if (e.key === 'Enter') {
    sendButton.click();
  }
};

function addMessage(text, type) {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.color = type === 'system' ? '#666' : '#000';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}
\`\`\`

### Step 5: Test Your Chat App

1. Make sure your server is running (\`node server.js\`)
2. Open \`index.html\` in two different browser windows
3. Type a message in one window and hit Send
4. You should see the message appear in both windows instantly! 🎉

## How It Works

Here's what happens when you send a message:

1. **Client → Server**: Your browser sends the message through the WebSocket connection
2. **Server Processing**: The server receives the message and loops through all connected clients
3. **Server → Clients**: The server broadcasts the message to every connected client (including you)
4. **Client Display**: Each client receives the message and adds it to the chat UI

WebSockets maintain a persistent, bidirectional connection. Unlike HTTP requests (which are one-shot), WebSocket connections stay open, allowing real-time two-way communication.

## Troubleshooting

**"Connection refused" error:**
- Make sure your server is running (\`node server.js\`)
- Check that the port 8080 isn't already in use
- Verify the WebSocket URL matches your server port

**Messages not appearing:**
- Check the browser console for errors
- Verify your server logs show "New client connected"
- Make sure you're using \`ws://\` not \`http://\`

**Server crashes with "Cannot find module 'ws'":**
- Run \`npm install\` to install dependencies
- Check that \`package.json\` includes \`ws\`

## Next Steps

Congratulations! You've built a working real-time chat app. Here are some ways to enhance it:

- **Add usernames**: Let users set a name and show who sent each message
- **Message timestamps**: Display when each message was sent
- **User list**: Show all currently connected users
- **Private messages**: Allow direct messages between users
- **Persistence**: Store messages in a database (MongoDB, PostgreSQL)
- **Security**: Add authentication and message validation
- **Styling**: Improve the UI with a framework like React or Vue

### Related Tutorials

- [Build a Chat App with Socket.io](https://example.com/socketio-tutorial)
- [WebSocket Security Best Practices](https://example.com/websocket-security)
- [Real-Time Collaboration with CRDTs](https://example.com/crdt-tutorial)

Happy coding! 🚀`,
};

export default tutorialTemplate;
