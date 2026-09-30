const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;

const suspects = [
  { id:"claire", name:"Claire Blackwood", role:"witness", statement:"I argued with my father earlier. I was angry, but I did not go into his study after 10:30." },
  { id:"marcus", name:"Marcus Reed", role:"witness", statement:"Alexander and I had business disagreements. I spent most of the late evening in the drawing room." },
  { id:"elena", name:"Elena Torres", role:"witness", statement:"I entered the study earlier in the evening for work. I did not see Alexander after 10:20." },
  { id:"daniel", name:"Daniel Cross", role:"criminal", statement:"Alexander was my client for years. I remained with the other guests. I never entered the library that evening." }
];

const evidence = [
  { id:"E-01", title:"Scene Photograph", text:"The study drawers are open. A whiskey glass lies shattered near the desk. No obvious forced entry." },
  { id:"E-02", title:"Brass Bookend", text:"A heavy brass bookend appears recently wiped. Trace blood remains inside a decorative groove." },
  { id:"E-03", title:"Victim Phone Record", text:"Final outgoing call placed at 10:41 PM. No calls were made after that time." },
  { id:"E-04", title:"Claire Blackwood — Text Message", text:"At 9:58 PM Claire wrote: “You cannot keep doing this to me.”" },
  { id:"E-05", title:"Marcus Reed — Financial Review", text:"Records indicate unexplained company transfers linked to Marcus Reed." },
  { id:"E-06", title:"Elena Torres — Recovered Document", text:"A confidential document removed from the study was found among Elena’s belongings." },
  { id:"E-07", title:"Security Access Log", text:"The secondary door between the study and library opened at exactly 10:57 PM." },
  { id:"E-08", title:"Exterior Trace Report", text:"Mud recovered near the library exit is consistent with residue recovered from Daniel Cross’s shoe." },
  { id:"E-09", title:"Deleted Email", text:"Blackwood planned to disclose fraudulent property transactions involving his attorney." },
  { id:"E-10", title:"Missing Watch Recovery", text:"Blackwood’s missing watch was recovered outside near the library-side grounds." }
];

const privateRoles = {
  detective: {
    title:"Detective",
    brief:"Identify Alexander Blackwood’s killer. Innocent witnesses may conceal unrelated misconduct."
  },
  witness: {
    title:"Witness",
    brief:"You are not the killer. You may possess information that makes you look suspicious. Help or withhold information as you judge appropriate."
  },
  criminal: {
    title:"Criminal",
    brief:"You killed Alexander Blackwood after he threatened to expose fraudulent property transactions. You struck him with the brass bookend, staged a robbery, took his watch, and escaped through the library. Avoid a correct accusation."
  }
};

function code() {
  let c;
  do c = crypto.randomBytes(3).toString("hex").toUpperCase();
  while (rooms.has(c));
  return c;
}
function cleanName(v) {
  return String(v || "Investigator").replace(/[<>]/g,"").trim().slice(0,24) || "Investigator";
}
function roomPublic(room) {
  return {
    code: room.code,
    phase: room.phase,
    aiFill: room.aiFill,
    hostId: room.hostId,
    players: room.players.map(p => ({id:p.id,name:p.name,isAI:p.isAI,connected:p.connected})),
    unlocked: [...room.unlocked],
    startedAt: room.startedAt,
    chat: room.chat.slice(-80),
    accusation: room.phase === "reveal" ? room.accusation : null
  };
}
function emitRoom(room) { io.to(room.code).emit("roomState", roomPublic(room)); }

function addAI(room) {
  const names = ["Morgan Hale","Avery Quinn","Jordan Price","Riley Shaw","Cameron Vale","Taylor Knox"];
  while (room.players.length < MAX_PLAYERS) {
    const idx = room.players.length;
    room.players.push({id:`ai-${crypto.randomBytes(4).toString("hex")}`,name:names[idx] || `AI ${idx+1}`,isAI:true,connected:true,role:null});
  }
}
function assignRoles(room) {
  // Human/AI player roles: 2 detectives, 3 witnesses, 1 criminal when full.
  const shuffled = [...room.players].sort(()=>Math.random()-0.5);
  const roles = shuffled.length >= 6
    ? ["detective","detective","witness","witness","witness","criminal"]
    : shuffled.length >= 4
      ? ["detective","witness","witness","criminal"]
      : ["detective","criminal"];
  shuffled.forEach((p,i)=>p.role=roles[i] || "witness");
  // Guarantee one criminal.
  if (!shuffled.some(p=>p.role==="criminal")) shuffled[shuffled.length-1].role="criminal";
}
function privateState(room, player) {
  return {
    role: privateRoles[player.role],
    roleKey: player.role,
    evidence: evidence.filter(e=>room.unlocked.has(e.id)),
    suspects: suspects.map(s=>({id:s.id,name:s.name,statement:s.statement})),
  };
}
function startRoom(room) {
  if (room.aiFill) addAI(room);
  if (room.players.length < MIN_PLAYERS) return false;
  assignRoles(room);
  room.phase = "investigation";
  room.startedAt = Date.now();
  room.unlocked = new Set(["E-01","E-02","E-03","E-04"]);
  room.searchIndex = 4;
  room.players.filter(p=>!p.isAI).forEach(p=>{
    const sock = io.sockets.sockets.get(p.id);
    if (sock) sock.emit("privateState", privateState(room,p));
  });
  emitRoom(room);
  return true;
}

io.on("connection", socket => {
  socket.on("createRoom", ({name, aiFill=true}, ack=()=>{}) => {
    const c=code();
    const room={code:c,phase:"lobby",aiFill:!!aiFill,hostId:socket.id,players:[],unlocked:new Set(),searchIndex:0,startedAt:null,chat:[],accusation:null};
    room.players.push({id:socket.id,name:cleanName(name),isAI:false,connected:true,role:null});
    rooms.set(c,room); socket.join(c); socket.data.roomCode=c;
    ack({ok:true,code:c}); emitRoom(room);
  });

  socket.on("joinRoom", ({code:raw,name}, ack=()=>{}) => {
    const c=String(raw||"").trim().toUpperCase();
    const room=rooms.get(c);
    if(!room) return ack({ok:false,error:"Room not found."});
    if(room.phase!=="lobby") return ack({ok:false,error:"Case already started."});
    if(room.players.length>=MAX_PLAYERS) return ack({ok:false,error:"Room is full."});
    room.players.push({id:socket.id,name:cleanName(name),isAI:false,connected:true,role:null});
    socket.join(c); socket.data.roomCode=c; ack({ok:true,code:c}); emitRoom(room);
  });

  socket.on("setAiFill", (enabled) => {
    const room=rooms.get(socket.data.roomCode);
    if(!room || room.hostId!==socket.id || room.phase!=="lobby") return;
    room.aiFill=!!enabled; emitRoom(room);
  });

  socket.on("startGame", (_, ack=()=>{}) => {
    const room=rooms.get(socket.data.roomCode);
    if(!room) return ack({ok:false,error:"Room missing."});
    if(room.hostId!==socket.id) return ack({ok:false,error:"Only the host can begin."});
    if(!startRoom(room)) return ack({ok:false,error:"At least two total players are required."});
    ack({ok:true});
  });

  socket.on("requestPrivateState", () => {
    const room=rooms.get(socket.data.roomCode);
    const p=room?.players.find(x=>x.id===socket.id);
    if(room && p && p.role) socket.emit("privateState", privateState(room,p));
  });

  socket.on("searchEvidence", (_, ack=()=>{}) => {
    const room=rooms.get(socket.data.roomCode);
    if(!room || room.phase!=="investigation") return ack({ok:false,error:"Investigation is not active."});
    if(room.searchIndex>=evidence.length) return ack({ok:false,error:"All evidence has been recovered."});
    const item=evidence[room.searchIndex++];
    room.unlocked.add(item.id);
    room.players.filter(p=>!p.isAI).forEach(p=>{
      const sock=io.sockets.sockets.get(p.id);
      if(sock) sock.emit("privateState", privateState(room,p));
    });
    emitRoom(room); ack({ok:true,item});
  });

  socket.on("chatMessage", ({text}) => {
    const room=rooms.get(socket.data.roomCode);
    const p=room?.players.find(x=>x.id===socket.id);
    const msg=String(text||"").trim().slice(0,500);
    if(!room || !p || !msg || room.phase!=="investigation") return;
    room.chat.push({id:crypto.randomUUID(),playerId:p.id,name:p.name,text:msg,at:Date.now()});
    emitRoom(room);
    // Lightweight AI participation for prototype.
    const ai = room.players.find(x=>x.isAI);
    if(ai && Math.random() < 0.45) {
      setTimeout(()=>{
        if(room.phase!=="investigation") return;
        const lines=[
          "That timeline does not fully account for the library door.",
          "I would compare that statement against the physical evidence.",
          "The financial records establish motive, but not necessarily murder.",
          "Someone may be lying for a reason unrelated to the killing."
        ];
        room.chat.push({id:crypto.randomUUID(),playerId:ai.id,name:ai.name,text:lines[Math.floor(Math.random()*lines.length)],at:Date.now()});
        emitRoom(room);
      },700);
    }
  });

  socket.on("submitAccusation", (a, ack=()=>{}) => {
    const room=rooms.get(socket.data.roomCode);
    const p=room?.players.find(x=>x.id===socket.id);
    if(!room || !p || room.phase!=="investigation") return ack({ok:false,error:"No active investigation."});
    if(p.role!=="detective") return ack({ok:false,error:"Only a detective may submit the final accusation."});
    const accusation={
      by:p.name,
      suspect:String(a?.suspect||""),
      motive:String(a?.motive||""),
      weapon:String(a?.weapon||""),
      proof:String(a?.proof||"")
    };
    accusation.correct = accusation.suspect==="Daniel Cross" &&
      accusation.motive==="Concealment of financial fraud" &&
      accusation.weapon==="Brass bookend";
    room.accusation=accusation; room.phase="reveal"; emitRoom(room); ack({ok:true,correct:accusation.correct});
  });

  socket.on("disconnect", () => {
    const room=rooms.get(socket.data.roomCode);
    if(!room) return;
    const p=room.players.find(x=>x.id===socket.id);
    if(p) p.connected=false;
    if(room.phase==="lobby") {
      room.players=room.players.filter(x=>x.id!==socket.id);
      if(room.hostId===socket.id) {
        const next=room.players.find(x=>!x.isAI);
        if(next) room.hostId=next.id;
      }
    }
    if(!room.players.some(x=>!x.isAI && x.connected)) rooms.delete(room.code);
    else emitRoom(room);
  });
});

app.get("/health", (_,res)=>res.json({ok:true,rooms:rooms.size}));
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Case Unknown listening on http://localhost:${PORT}`));
