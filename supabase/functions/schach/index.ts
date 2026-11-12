// Online-Schach server: checks every move with chess.js and runs the clocks.
// Actions: create, join, leave, move, resign, draw (offer/accept/decline), flag, rematch, state.
// Uses the same chess.js version (0.10.3) as the page in schach/chess.js.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import chessPkg from 'npm:chess.js@0.10.3';
const { Chess } = chessPkg as any;

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

class GameError extends Error { constructor(msg: string, public status = 400, public code = '') { super(msg); } }
const err = (m: string, s = 400, c = '') => new GameError(m, s, c);

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const rand = (n: number) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const newToken = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); };
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join('');
const cleanName = (s: unknown, fb: string) => String(s ?? '').replace(/[<>"&]/g, '').trim().slice(0, 16) || fb;
function cleanTc(tc: any) {
  if (!tc || typeof tc !== 'object') return null;
  const base = Math.round(Number(tc.base)), inc = Math.round(Number(tc.inc) || 0);
  if (!(base >= 10000 && base <= 3 * 3600000)) return null;
  return { base, inc: Math.max(0, Math.min(inc, 180000)) };
}

async function load(code: unknown) {
  const { data: room, error } = await sb.from('schach_rooms').select('id,code,state,version')
    .eq('code', String(code || '').toUpperCase().trim()).maybeSingle();
  if (error) throw error;
  if (!room) throw err('Diesen Raum gibt es nicht (mehr).', 404, 'noRoom');
  const { data: seats } = await sb.from('schach_seats').select('seat,token').eq('room_id', room.id);
  const tokens: string[] = [];
  (seats || []).forEach((s: any) => { tokens[s.seat] = s.token; });
  return { room, st: room.state, tokens };
}
async function save(room: any, st: any) {
  st.savedAt = Date.now();
  const { data, error } = await sb.rpc('schach_save', { p_room: room.id, p_version: room.version, p_state: st });
  if (error) {
    if (String(error.message).includes('schach_conflict')) throw err('Jemand war schneller.', 409, 'conflict');
    throw error;
  }
  return data as number;
}
function seatOf(tokens: string[], tok: unknown) {
  const s = typeof tok === 'string' && tok.length >= 24 ? tokens.indexOf(tok) : -1;
  if (s < 0) throw err('Du sitzt nicht in diesem Raum.', 403, 'notInRoom');
  return s;
}
const colorOf = (st: any, seat: number) => (st.white === seat ? 'w' : 'b');

// can this side still mate at all? (only king, or king + one minor piece cannot)
function canMate(fen: string, color: string) {
  const c = new Chess(fen); let minors = 0, other = 0;
  c.board().forEach((r: any[]) => r.forEach(p => {
    if (!p || p.color !== color || p.type === 'k') return;
    if (p.type === 'n' || p.type === 'b') minors++; else other++;
  }));
  return other > 0 || minors >= 2;
}
function finish(st: any, winner: string | null, reason: string) {
  st.status = 'over'; st.result = { winner, reason }; st.drawOffer = null;
  if (st.clock) st.clock.since = null;
}
function timeout(st: any, loser: string) {
  const w = loser === 'w' ? 'b' : 'w';
  finish(st, canMate(st.fen, w) ? w : null, 'time');
}
// remaining time of the side to move, right now
function liveLeft(st: any, now: number) {
  const ck = st.clock; if (!ck) return Infinity;
  const turn = new Chess(st.fen).turn();
  return ck[turn] - (ck.since ? now - ck.since : 0);
}
function startGame(st: any) {
  if (st.colorPref === 'w') st.white = 0; else if (st.colorPref === 'b') st.white = 1;
  else st.white = rand(2);
  st.status = 'play'; st.fen = START; st.moves = []; st.result = null; st.drawOffer = null; st.rematch = [false, false];
  st.clock = st.tc ? { w: st.tc.base, b: st.tc.base, since: null } : null;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const now = Date.now();
    switch (b.action) {
      case 'create': {
        await sb.from('schach_rooms').delete().lt('updated_at', new Date(now - 3 * 864e5).toISOString());
        const st: any = {
          status: 'lobby', players: [{ name: cleanName(b.name, 'Spieler 1') }, null],
          colorPref: ['w', 'b'].includes(b.color) ? b.color : 'r', white: 0, tc: cleanTc(b.tc),
          fen: START, moves: [], clock: null, result: null, drawOffer: null, rematch: [false, false], game: 1, left: [false, false],
        };
        let room: any = null;
        for (let i = 0; i < 8 && !room; i++) {
          const { data, error } = await sb.from('schach_rooms').insert({ code: newCode(), state: { ...st, savedAt: now } }).select('id,code,state,version').maybeSingle();
          if (!error) room = data; else if (!String(error.message).includes('duplicate')) throw error;
        }
        if (!room) throw err('Kein freier Raum-Code gefunden.', 500, 'server');
        const token = newToken();
        await sb.from('schach_seats').insert({ room_id: room.id, seat: 0, token });
        return json({ code: room.code, roomId: room.id, seat: 0, token, now });
      }
      case 'join': {
        const { room, st, tokens } = await load(b.code);
        if (st.status !== 'lobby' || st.players[1]) throw err('Der Raum ist schon voll.', 409, 'full');
        st.players[1] = { name: cleanName(b.name, 'Spieler 2') };
        startGame(st);
        const token = newToken();
        const { error } = await sb.from('schach_seats').insert({ room_id: room.id, seat: 1, token });
        if (error) throw err('Der Raum ist schon voll.', 409, 'full');
        tokens[1] = token;
        await save(room, st);
        return json({ code: room.code, roomId: room.id, seat: 1, token, now });
      }
      case 'state': {
        const { room } = await load(b.code);
        return json({ ok: true, now, version: room.version });
      }
      case 'leave': {
        const { room, st, tokens } = await load(b.code);
        const seat = seatOf(tokens, b.token);
        if (st.status === 'lobby') {
          await sb.from('schach_rooms').delete().eq('id', room.id);
          return json({ ok: true, now });
        }
        st.left[seat] = true;
        if (st.status === 'play') finish(st, colorOf(st, 1 - seat), 'abandon');
        await save(room, st);
        return json({ ok: true, now });
      }
      case 'move': {
        const { room, st, tokens } = await load(b.code);
        const seat = seatOf(tokens, b.token);
        if (st.status !== 'play') throw err('Die Partie ist schon vorbei.', 409, 'over');
        const c = new Chess(st.fen), turn = c.turn();
        if (colorOf(st, seat) !== turn) throw err('Du bist nicht am Zug.', 409, 'notYourTurn');
        const uci = String(b.uci || '');
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw err('Dieser Zug ist nicht erlaubt.', 400, 'illegal');
        const ck = st.clock;
        if (ck && ck.since) {
          const left = ck[turn] - (now - ck.since);
          if (left <= 0) { timeout(st, turn); await save(room, st); return json({ ok: true, now, timeout: true }); }
          ck[turn] = left + st.tc.inc;
        }
        const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
        if (!m) throw err('Dieser Zug ist nicht erlaubt.', 400, 'illegal');
        st.fen = c.fen(); st.moves.push(m.from + m.to + (m.promotion || ''));
        // moving instead of answering declines the opponent's draw offer
        if (st.drawOffer && st.drawOffer !== turn) st.drawOffer = null;
        // clocks start once White has made the first move
        if (ck) ck.since = st.moves.length >= 1 ? now : null;
        if (c.in_checkmate()) finish(st, turn, 'mate');
        else if (c.in_stalemate()) finish(st, null, 'stalemate');
        else if (c.insufficient_material()) finish(st, null, 'material');
        else if (c.in_threefold_repetition()) finish(st, null, 'repetition');
        else if (c.in_draw()) finish(st, null, 'fifty');
        await save(room, st);
        return json({ ok: true, now });
      }
      case 'resign': {
        const { room, st, tokens } = await load(b.code);
        const seat = seatOf(tokens, b.token);
        if (st.status !== 'play') throw err('Die Partie ist schon vorbei.', 409, 'over');
        finish(st, colorOf(st, 1 - seat), 'resign');
        await save(room, st);
        return json({ ok: true, now });
      }
      case 'draw': {
        const { room, st, tokens } = await load(b.code);
        const seat = seatOf(tokens, b.token), me = colorOf(st, seat);
        if (st.status !== 'play') throw err('Die Partie ist schon vorbei.', 409, 'over');
        if (b.op === 'offer') { if (!st.drawOffer) st.drawOffer = me; }
        else if (b.op === 'accept' && st.drawOffer && st.drawOffer !== me) finish(st, null, 'agreed');
        else if (b.op === 'decline' && st.drawOffer && st.drawOffer !== me) { st.drawOffer = null; st.drawDeclined = (st.drawDeclined || 0) + 1; }
        await save(room, st);
        return json({ ok: true, now });
      }
      case 'flag': {
        const { room, st, tokens } = await load(b.code);
        seatOf(tokens, b.token);
        if (st.status !== 'play' || !st.clock) throw err('Die Partie ist schon vorbei.', 409, 'over');
        if (liveLeft(st, now) > 0) throw err('Die Zeit ist noch nicht abgelaufen.', 409, 'notOver');
        timeout(st, new Chess(st.fen).turn());
        await save(room, st);
        return json({ ok: true, now });
      }
      case 'rematch': {
        const { room, st, tokens } = await load(b.code);
        const seat = seatOf(tokens, b.token);
        if (st.status !== 'over') throw err('Die Partie läuft noch.', 409, 'notOver');
        if (st.left[1 - seat]) throw err('Der Gegner hat den Raum verlassen.', 409, 'noRoom');
        st.rematch[seat] = true;
        if (st.rematch[0] && st.rematch[1]) {
          const prevWhite = st.white;
          startGame(st);
          st.white = 1 - prevWhite; st.game = (st.game || 1) + 1;
        }
        await save(room, st);
        return json({ ok: true, now });
      }
      default: throw err('Unbekannte Aktion.', 400, 'bad');
    }
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.message, code: e.code }, e.status);
    console.error(e);
    return json({ error: 'Serverfehler', code: 'server' }, 500);
  }
});
