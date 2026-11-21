const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static('public'));
app.get('/health', (_, res) => res.json({ ok: true, game: 'The Unchosen' }));

const rooms = new Map();
const MAX_PLAYERS = 100;
const chapters = [
  { title: 'THE BROKEN GATE', eyebrow: 'CHAPTER I · THE CALL', scene: 'The eastern gate is collapsing. Villagers are trapped beneath the wreckage. A fire is spreading toward the watchtower, where the only detailed map to the Mountain of Echoes is kept. Aren has time to do only one thing.', a: 'RESCUE THE VILLAGERS', ad: 'Save the trapped people. The detailed map may be lost.', b: 'SECURE THE MAP', bd: 'Protect the route. The villagers may be left behind.', ca: 'Mira and her father, a bridge engineer, survive. They may help later.', cb: 'The map is saved, but the engineer is lost. Survivors remember the choice.', echo: 'A shadow appears behind Aren: a burning map, or a hand reaching for help.' },
  { title: 'THE KEEPER OF THE FOREST', eyebrow: 'CHAPTER II · THE MENTOR', scene: 'At the forest sanctuary, Elar offers two artifacts made from the Heartstone’s original magic. The Dawnblade can destroy creatures of darkness, but every strike consumes the fragment’s light. The Book of Echoes reveals hidden paths and ancient secrets, but offers no protection.', a: 'TAKE THE DAWNBLADE', ad: 'Fight the darkness directly, but spend precious Heartstone light.', b: 'TAKE THE BOOK OF ECHOES', bd: 'Learn hidden paths and the mountain’s secrets, but remain vulnerable.', ca: 'Aren can fight directly. The Unchosen inherits knowledge of the forge.', cb: 'Aren understands the Echoes. The Unchosen inherits a shadow blade.', echo: 'The rejected artifact glows. Its shadow detaches and slips into the forest.' },
  { title: 'THE LAST BRIDGE', eyebrow: 'CHAPTER III · THE THRESHOLD', scene: 'The only bridge to the mountain is failing. Refugees are waiting to cross as darkness advances. Aren must choose between helping them and preserving the fragment’s remaining time. If the engineer was saved, he can reinforce the bridge.', a: 'HELP THE REFUGEES CROSS', ad: 'Risk the mission to bring people to safety.', b: 'CROSS IMMEDIATELY', bd: 'Reach the mountain sooner, but leave people behind.', ca: 'Survivors may join Aren, but the fragment loses time.', cb: 'Aren reaches the mountain sooner. The abandoned strengthen the Echo.', echo: 'A voice rises from the ravine: “You call it a choice. We call it abandonment.”' },
  { title: 'THE HEARTFORGE', eyebrow: 'CHAPTER IV · THE ORDEAL', scene: 'At the summit, the Unchosen emerges: a living accumulation of every rejected possibility. It carries the powers and grievances created by the kingdom’s votes. The citizens must guide Aren through the confrontation.', a: 'STAND TOGETHER', ad: 'Use allies and the strength of the chosen path to hold the line.', b: 'UNDERSTAND THE ECHOES', bd: 'Read the Unchosen’s pattern and attempt reconciliation.', ca: 'A direct confrontation. Success depends on the resources gathered.', cb: 'A chance to reintegrate the Echoes, if enough knowledge and light remain.', echo: 'The Heartforge waits. The kingdom’s fate is in every citizen’s hands.' }
];
function newRoom(hostName) {
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  return { code, hostName, hostId: null, players: new Map(), chapter: -1, phase: 'lobby', votes: {}, history: [], deadline: null, timer: null, created: Date.now() };
}
function publicState(r) {
  const c = chapters[r.chapter];
  const total = r.players.size;
  const counts = { A: 0, B: 0 };
  Object.values(r.votes).forEach(v => counts[v]++);
  return { code: r.code, hostName: r.hostName, players: [...r.players.values()].map(p => ({ name: p.name, isHost: p.isHost })), playerCount: total, maxPlayers: MAX_PLAYERS, chapter: r.chapter, phase: r.phase, chapterData: c || null, counts, voted: Object.keys(r.votes).length, deadline: r.deadline, history: r.history, result: r.result || null };
}
function emitRoom(r) { io.to(r.code).emit('state', publicState(r)); }
function resolveVote(r) {
  if (r.phase !== 'voting') return;
  clearTimeout(r.timer); r.timer = null;
  const counts = { A: 0, B: 0 };
  Object.values(r.votes).forEach(v => counts[v]++);
  let winner = counts.A === counts.B ? 'A' : (counts.A > counts.B ? 'A' : 'B');
  const c = chapters[r.chapter];
  r.history.push({ chapter: r.chapter, title: c.title, winner, counts, total: r.players.size, minority: winner === 'A' ? 'B' : 'A' });
  r.result = { winner, counts, title: winner === 'A' ? c.a : c.b, consequence: winner === 'A' ? c.ca : c.cb, echo: c.echo, tie: counts.A === counts.B };
  r.phase = 'result'; r.deadline = null; emitRoom(r);
}
function startVote(r) {
  r.phase = 'voting'; r.votes = {}; r.result = null; r.deadline = Date.now() + 30000;
  clearTimeout(r.timer); r.timer = setTimeout(() => resolveVote(r), 30000);
  emitRoom(r);
}
function finishGame(r) {
  const h = r.history;
  const rescued = h[0]?.winner === 'A';
  const book = h[1]?.winner === 'B';
  const refugees = h[2]?.winner === 'A';
  const knowledge = book;
  const light = h[1]?.winner === 'B' && h[2]?.winner === 'B';
  let ending = knowledge && light ? 'THE UNCHOSEN IS UNDERSTOOD' : (rescued && refugees ? 'THE HERO TRIUMPHS' : 'THE KINGDOM FALLS TO THE UNCHOSEN');
  let desc = ending === 'THE UNCHOSEN IS UNDERSTOOD' ? 'Aren sees that the Unchosen is made of rejected possibilities, not pure evil. The forge reintegrates the Echoes. The Heartstone remembers every voice, chosen and rejected.' : ending === 'THE HERO TRIUMPHS' ? 'With allies at his side, Aren overcomes the Unchosen and restores the Heartstone. The kingdom survives — but the Echoes leave one final warning.' : 'The Unchosen overwhelms Aren. The Heartstone’s light fades, and the protective barrier collapses. The kingdom must face the darkness it tried to leave behind.';
  r.final = { ending, desc, history: h };
  r.phase = 'ended'; emitRoom(r);
}

io.on('connection', socket => {
  socket.on('create-room', async ({ name }, cb) => {
    const r = newRoom((name || 'Host').slice(0, 20)); r.hostId = socket.id; r.players.set(socket.id, { name: r.hostName, isHost: true }); rooms.set(r.code, r); socket.join(r.code);
    const base = process.env.PUBLIC_URL || `${socket.handshake.headers['x-forwarded-proto'] || 'http'}://${socket.handshake.headers.host}`;
    const joinUrl = `${base}/?room=${r.code}`;
    const qr = await QRCode.toDataURL(joinUrl, { width: 360, margin: 2, color: { dark: '#10131d', light: '#ffffff' } });
    cb({ ok: true, code: r.code, qr, joinUrl }); emitRoom(r);
  });
  socket.on('join-room', ({ code, name }, cb) => {
    const r = rooms.get(String(code || '').toUpperCase());
    if (!r) return cb({ ok: false, error: 'Room not found. Check the code with your host.' });
    if (r.phase !== 'lobby') return cb({ ok: false, error: 'This adventure has already started.' });
    if (r.players.size >= MAX_PLAYERS) return cb({ ok: false, error: 'This room has reached its 100-player limit.' });
    const clean = String(name || 'Citizen').trim().slice(0, 20) || 'Citizen';
    r.players.set(socket.id, { name: clean, isHost: false }); socket.join(r.code); socket.data.room = r.code;
    cb({ ok: true, code: r.code, name: clean }); emitRoom(r);
  });
  socket.on('host-start', ({ code }, cb) => { const r = rooms.get(code); if (!r || r.hostId !== socket.id) return cb?.({ ok: false }); if (r.players.size < 1) return cb?.({ ok: false, error: 'Waiting for players.' }); r.chapter = 0; startVote(r); cb?.({ ok: true }); });
  socket.on('vote', ({ code, choice }, cb) => { const r = rooms.get(code); if (!r || r.phase !== 'voting' || !r.players.has(socket.id) || !['A','B'].includes(choice)) return cb?.({ ok: false }); r.votes[socket.id] = choice; cb?.({ ok: true }); emitRoom(r); });
  socket.on('host-next', ({ code }, cb) => { const r = rooms.get(code); if (!r || r.hostId !== socket.id || r.phase !== 'result') return cb?.({ ok: false }); if (r.chapter < 2) { r.chapter++; startVote(r); } else { r.chapter++; finishGame(r); } cb?.({ ok: true }); });
  socket.on('host-restart', ({ code }, cb) => { const r = rooms.get(code); if (!r || r.hostId !== socket.id) return cb?.({ ok: false }); clearTimeout(r.timer); r.chapter = -1; r.phase = 'lobby'; r.votes = {}; r.history = []; r.result = null; r.final = null; emitRoom(r); cb?.({ ok: true }); });
  socket.on('disconnect', () => { for (const r of rooms.values()) { if (r.players.has(socket.id)) { if (r.hostId === socket.id) { r.phase = 'closed'; io.to(r.code).emit('closed'); rooms.delete(r.code); } else { r.players.delete(socket.id); delete r.votes[socket.id]; emitRoom(r); } } } });
});
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => console.log(`The Unchosen running on ${PORT}`));
}
module.exports = server;
