const WebSocket = require('ws');

// allow overriding the port via environment (useful during development)

const PORT = process.env.PORT || 9000;

// create the WebSocket server and log once it's actually listening


const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log("Signaling Server running on ws://localhost:" + PORT);
});


// ვინ რომელი peerId-ით არის სისტემაში
const connectedUsers = new Map();
// clientId → { ws, username, peerId }


// --- კლიენტი შემოვიდა ---


wss.on('connection', (ws) => {
  const clientId = Date.now().toString() + Math.random().toString(36).slice(2);

  console.log("Client connected:", clientId);

  // --- მესიჯები --- 

  ws.on('message', (msg) => {
    const data = JSON.parse(msg.toString());

    switch (data.type) {

    
      case "register":
        connectedUsers.set(clientId, {
          ws,
          username: data.username,
          peerId: data.peerId
        });
        console.log("Registered:", data);
        broadcastUsers();
        break;


      
      // 2) Offer → გაგზავნა მიზნობრივ peer-ს

      case "offer":
        sendToPeer(data.targetPeerId, {
          type: "offer",
          fromPeerId: data.fromPeerId,
          offer: data.offer
        });
        break;


 
      // 3) Answer → გაგზავნა მიზნობრივ peer-ს

      case "answer":
        sendToPeer(data.targetPeerId, {
          type: "answer",
          fromPeerId: data.fromPeerId,
          answer: data.answer
        });
        break;



      // 4) ICE candidate → გაგზავნა მიზნობრივ peer-ს
 
      case "ice-candidate":
        sendToPeer(data.targetPeerId, {
          type: "ice-candidate",
          fromPeerId: data.fromPeerId,
          candidate: data.candidate
        });
        break;
    }
  });


  // --- კლიენტი გავიდა ---
  ws.on('close', () => {
    console.log("Client disconnected:", clientId);
    connectedUsers.delete(clientId);
    broadcastUsers();
  });
});


// Helper: Users Pool broadcast

function broadcastUsers() {
  const users = Array.from(connectedUsers.values()).map(u => ({
    username: u.username,
    peerId: u.peerId
  }));

  const msg = JSON.stringify({
    type: "users",
    users
  });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });

  console.log("Broadcast users:", users);
}



// Helper: Send message to a peerId

function sendToPeer(peerId, message) {
  const target = [...connectedUsers.values()].find(u => u.peerId === peerId);

  if (!target) {
    console.log("Target peer not found:", peerId);
    return;
  }

  if (target.ws.readyState === WebSocket.OPEN) {
    target.ws.send(JSON.stringify(message));
  }
}

// better error messaging for common failures (e.g. port already in use)
wss.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Either stop the process using it or set PORT to a different value.`);
  } else {
    console.error('WebSocket server error:', err);
  }
  // exit with failure so a supervisor / user sees failure
  process.exit(1);
});
