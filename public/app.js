const socket = io();
const $ = id => document.getElementById(id);
let roomCode = null, isHost = false, myName = '', myVote = null, currentState = null, timerLoop = null, audioCtx = null, drone = null;
const screens = ['landing','joinScreen','hostScreen','playerWaiting','gameScreen'];
function show(id){ screens.forEach(s=>$(s).classList.toggle('hidden',s!==id)); }
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function sound(type='tap'){
  try{ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended')audioCtx.resume(); const now=audioCtx.currentTime; const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.connect(g);g.connect(audioCtx.destination); o.type='sine'; const f=type==='vote'?440:type==='start'?330:type==='win'?660:260; o.frequency.setValueAtTime(f,now);o.frequency.exponentialRampToValueAtTime(f*1.45,now+.18);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.055,now+.025);g.gain.exponentialRampToValueAtTime(.0001,now+.42);o.start(now);o.stop(now+.44);
    if(type==='start'&&!drone){const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=55;gain.gain.value=.012;osc.connect(gain);gain.connect(audioCtx.destination);osc.start();drone={osc,gain};}
  }catch(e){}
}
function showJoin(){show('joinScreen');$('playerName').focus()}
$('createBtn').onclick=()=>{sound();const name=prompt('What should the kingdom call its host?','Game Master')||'Game Master';socket.emit('create-room',{name},res=>{if(!res?.ok)return toast('Could not create room.');isHost=true;roomCode=res.code;$('roomCode').textContent=res.code;$('qr').src=res.qr;$('joinUrl').textContent=res.joinUrl;show('hostScreen');});};
$('showJoin').onclick=()=>{sound();showJoin()};
$('roomInput').addEventListener('keydown',e=>{if(e.key==='Enter')showJoin()});
$('[data-back]').onclick=()=>show('landing');
$('joinBtn').onclick=()=>join();
$('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')join()});
function join(){const code=($('roomInput').value||new URLSearchParams(location.search).get('room')||'').trim().toUpperCase();const name=$('playerName').value.trim()||'Citizen';if(!code){$('joinError').textContent='Enter the room code shown by your host.';return;}socket.emit('join-room',{code,name},res=>{if(!res?.ok){$('joinError').textContent=res?.error||'Unable to join.';return;}roomCode=res.code;myName=res.name;isHost=false;sound('start');$('welcomeName').textContent=`Welcome, ${myName}.`;show('playerWaiting');});}
$('startBtn').onclick=()=>{sound('start');socket.emit('host-start',{code:roomCode},res=>{if(!res?.ok)toast(res?.error||'Could not start.');});};
$('nextBtn').onclick=()=>{sound('tap');socket.emit('host-next',{code:roomCode});};
$('restartBtn').onclick=()=>{socket.emit('host-restart',{code:roomCode});};
document.querySelectorAll('.vote-option').forEach(btn=>btn.onclick=()=>{if(myVote||!roomCode)return;myVote=btn.dataset.choice;sound('vote');document.querySelectorAll('.vote-option').forEach(b=>{b.classList.toggle('selected',b===btn);b.disabled=true;});$('voteStatus').textContent='YOUR VOTE HAS BEEN CAST';socket.emit('vote',{code:roomCode,choice:myVote},res=>{if(!res?.ok)toast('Your vote could not be recorded.');});});
function renderLobby(s){$('playerCount').textContent=s.playerCount;$('playerCountSmall').textContent=s.playerCount;$('waitingCount').textContent=s.playerCount;$('players').innerHTML='';s.players.forEach(p=>{const el=document.createElement('span');el.className='player-chip'+(p.isHost?' host':'');el.textContent=(p.isHost?'✧ ':'')+p.name;$('players').appendChild(el);});}
function renderGame(s){show('gameScreen');$('gamePlayerCount').textContent=s.playerCount;const idx=Math.min(s.chapter,3);$('chapterIndicator').textContent=`CHAPTER ${['I','II','III','IV'][idx]} / IV`;$('progressBar').style.width=`${(idx+1)*25}%`;
 if(s.phase==='voting'||s.phase==='result'){
  const c=s.chapterData;$('chapterEyebrow').textContent=c.eyebrow;$('chapterTitle').textContent=c.title;$('chapterScene').textContent=c.scene;$('optionA').textContent=c.a;$('descA').textContent=c.ad;$('optionB').textContent=c.b;$('descB').textContent=c.bd;
  $('voteArea').classList.toggle('hidden',s.phase!=='voting');$('resultArea').classList.toggle('hidden',s.phase!=='result');$('endingArea').classList.add('hidden');
  $('countA').textContent=s.counts.A;$('countB').textContent=s.counts.B;$('voteProgress').textContent=`${s.voted} / ${s.playerCount} VOTES`;
  const total=Math.max(1,s.counts.A+s.counts.B);$('meterA').style.width=(s.counts.A/total*100)+'%';$('meterB').style.width=(s.counts.B/total*100)+'%';
  if(s.phase==='voting'){
   if(!myVote && !isHost){document.querySelectorAll('.vote-option').forEach(b=>{b.disabled=false;b.classList.remove('selected')});$('voteStatus').textContent='YOUR VOICE MATTERS';}
   if(myVote){document.querySelectorAll('.vote-option').forEach(b=>{b.disabled=true;b.classList.toggle('selected',b.dataset.choice===myVote)});}
   if(timerLoop)clearInterval(timerLoop);const update=()=>{const left=Math.max(0,Math.ceil((s.deadline-Date.now())/1000));$('timer').textContent=`00:${String(left).padStart(2,'0')}`;};update();timerLoop=setInterval(update,250);
  }else{
   if(timerLoop)clearInterval(timerLoop);myVote=null;document.querySelectorAll('.vote-option').forEach(b=>{b.disabled=false;b.classList.remove('selected')});$('resultTitle').textContent=s.result.title;$('resultConsequence').textContent=s.result.consequence;$('resultEcho').textContent='“'+s.result.echo+'”';$('resultCounts').textContent=`A ${s.result.counts.A} votes  ·  B ${s.result.counts.B} votes${s.result.tie?'  ·  TIE — A prevails by the announced tie rule':''}`;$('nextBtn').classList.toggle('hidden',!isHost);$('waitHost').classList.toggle('hidden',isHost);sound('win');
  }
 } else if(s.phase==='ended'){
  $('voteArea').classList.add('hidden');$('resultArea').classList.add('hidden');$('endingArea').classList.remove('hidden');$('endingTitle').textContent=s.final?.ending||'THE CHRONICLE ENDS';$('endingDesc').textContent=s.final?.desc||'';$('endingHistory').innerHTML='';(s.final?.history||[]).forEach((h,i)=>{const d=document.createElement('div');d.className='history-row';d.innerHTML=`<span>${i+1}. ${h.title}</span><b>${h.winner==='A'?'CHOICE A':'CHOICE B'} · ${h.counts[h.winner]} votes</b>`;$('endingHistory').appendChild(d);});$('restartBtn').classList.toggle('hidden',!isHost);sound('win');
 }
}
socket.on('state',s=>{currentState=s;roomCode=s.code;if(isHost&&s.phase==='lobby'){show('hostScreen');renderLobby(s);}else if(!isHost&&s.phase==='lobby'){show('playerWaiting');$('waitingCount').textContent=s.playerCount;}else if(s.phase!=='closed'){renderGame(s);}});
socket.on('closed',()=>{toast('The host has closed this room.');setTimeout(()=>location.href='/',1600)});
// QR entry: show the name step automatically when the URL contains a room code.
const qrRoom=new URLSearchParams(location.search).get('room');if(qrRoom){$('roomInput').value=qrRoom.toUpperCase();showJoin();}
