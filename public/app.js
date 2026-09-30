
const socket=io();
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let room=null, privateState=null, state=null;
function show(id){["#home","#lobby","#game","#reveal"].forEach(x=>$(x).classList.toggle("hidden",x!==id));}
function msg(id,t){$(id).textContent=t||"";}
$("#create").onclick=()=>socket.emit("createRoom",{name:$("#name").value,aiFill:true},r=>{if(!r.ok)return msg("#homeMsg",r.error);room=r.code;});
$("#join").onclick=()=>socket.emit("joinRoom",{code:$("#codeInput").value,name:$("#name").value},r=>{if(!r.ok)return msg("#homeMsg",r.error);room=r.code;});
$("#aiFill").onchange=()=>socket.emit("setAiFill",$("#aiFill").checked);
$("#start").onclick=()=>socket.emit("startGame",{},r=>{if(!r.ok)msg("#lobbyMsg",r.error)});
$("#search").onclick=()=>socket.emit("searchEvidence",{},r=>msg("#searchMsg",r.ok?`Recovered ${r.item.id}: ${r.item.title}`:r.error));
socket.on("roomState",s=>{state=s;room=s.code;render();});
socket.on("privateState",p=>{privateState=p;renderPrivate();});
function render(){
  if(!state)return;
  if(state.phase==="lobby"){
    show("#lobby"); $("#roomCode").textContent=state.code; $("#aiFill").checked=state.aiFill;
    $("#players").innerHTML=state.players.map(p=>`<div class="player"><span>${esc(p.name)}</span><span class="tag">${p.isAI?"AI":"HUMAN"}${p.id===state.hostId?" • HOST":""}</span></div>`).join("");
    $("#start").style.display=state.hostId===socket.id?"inline-block":"none";
  } else if(state.phase==="investigation"){
    show("#game");$("#gameCode").textContent=state.code;$("#phase").textContent="Investigation Active";socket.emit("requestPrivateState");
    renderChat();
  } else if(state.phase==="reveal"){
    show("#reveal");const a=state.accusation;$("#verdict").textContent=a?.correct?"CASE SOLVED":"ACCUSATION INCORRECT";
    $("#accusationText").textContent=a?`${a.by} accused ${a.suspect}, citing ${a.weapon} and ${a.motive.toLowerCase()}.`:"";
  }
}
function renderPrivate(){
 if(!privateState)return;
 $("#roleTitle").textContent=privateState.role.title;$("#roleBrief").textContent=privateState.role.brief;
 $("#evidenceList").innerHTML=privateState.evidence.map(e=>`<div class="evidence"><strong>${esc(e.id)} — ${esc(e.title)}</strong><p>${esc(e.text)}</p></div>`).join("");
 $("#suspects").innerHTML=privateState.suspects.map(s=>`<div class="suspect"><strong>${esc(s.name)}</strong><p>“${esc(s.statement)}”</p></div>`).join("");
 $("#proof").innerHTML="<option></option>"+privateState.evidence.map(e=>`<option>${esc(e.id)} — ${esc(e.title)}</option>`).join("");
 const det=privateState.roleKey==="detective";$("#submitAccusation").disabled=!det; if(!det)msg("#accuseMsg","Your assigned role cannot submit the final accusation.");
}
function renderChat(){
 if(!state)return;
 const box=$("#messages");box.innerHTML=state.chat.map(m=>`<div class="msg"><strong>${esc(m.name)}</strong><div>${esc(m.text)}</div></div>`).join("");box.scrollTop=box.scrollHeight;
}
$("#chatForm").onsubmit=e=>{e.preventDefault();const i=$("#chatInput");if(i.value.trim())socket.emit("chatMessage",{text:i.value});i.value="";};
$("#submitAccusation").onclick=()=>{
 const a={suspect:$("#suspectSelect").value,motive:$("#motive").value,weapon:$("#weapon").value,proof:$("#proof").value};
 if(Object.values(a).some(v=>!v))return msg("#accuseMsg","Complete every field before submitting.");
 socket.emit("submitAccusation",a,r=>{if(!r.ok)msg("#accuseMsg",r.error)});
};
$$("[data-tab]").forEach(b=>b.onclick=()=>{$$(".panel").forEach(p=>p.classList.add("hidden"));$("#"+b.dataset.tab).classList.remove("hidden")});
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
