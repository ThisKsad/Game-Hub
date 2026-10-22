// Online-Scopa server: holds the deck and all hands, validates every move.
// Actions: create, join, leave, seat, rename, start, play, ai, next, again, replace.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import * as C from './core.js';

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

const newToken = () => {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
};
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[C.rand(CODE_CHARS.length)]).join('');
const cleanName = (s: unknown, fallback: string) => {
  const t = String(s ?? '').replace(/[<>"&]/g, '').trim().slice(0, 16);
  return t || fallback;
};
function pickCompName(players: any[]) {
  const used = players.map(p => p.name);
  const free = C.COMP_NAMES.filter(n => !used.includes(n));
  return free.length ? free[C.rand(free.length)] : 'Computer';
}
function cleanSettings(s: any) {
  const c = (s && s.custom) || {};
  return {
    mode: C.MODES[s?.mode as keyof typeof C.MODES] ? s.mode : 'house',
    custom: { classic: !!c.classic, ace: ['one', 'eleven', 'all'].includes(c.ace) ? c.ace : 'one', teams: c.teams !== false, free: !!c.free },
    target: s?.target === 21 ? 21 : 11,
  };
}

async function load(code: unknown) {
  const { data: room, error } = await sb.from('scopa_rooms').select('id,code,state,version')
    .eq('code', String(code || '').toUpperCase().trim()).maybeSingle();
  if (error) throw error;
  if (!room) throw C.err('Diesen Raum gibt es nicht (mehr). Prüf den Code.', 404, 'noRoom');
  const [{ data: sec }, { data: hands }] = await Promise.all([
    sb.from('scopa_secrets').select('data').eq('room_id', room.id).maybeSingle(),
    sb.from('scopa_hands').select('seat,token,cards').eq('room_id', room.id),
  ]);
  const st = room.state, d = (sec && sec.data) || {};
  const G: any = { ...st, deck: d.deck || [], piles: d.piles || [], lastSide: d.lastSide ?? null,
    hands: Array.from({ length: st.players.length }, () => []) };
  delete G.deckCount; delete G.handCounts; delete G.pileCounts;
  const tokens: string[] = [];
  (hands || []).forEach((h: any) => { G.hands[h.seat] = h.cards || []; tokens[h.seat] = h.token; });
  return { room, G, tokens };
}

async function save(room: any, G: any, tokens: string[]) {
  const hands = G.players.map((_: any, i: number) => ({ seat: i, token: tokens[i] || (tokens[i] = newToken()), cards: G.hands[i] || [] }));
  const { data, error } = await sb.rpc('scopa_save', {
    p_room: room.id, p_version: room.version, p_state: C.publicState(G),
    p_secrets: { deck: G.deck || [], piles: G.piles || [], lastSide: G.lastSide ?? null }, p_hands: hands,
  });
  if (error) {
    if (String(error.message).includes('scopa_conflict')) throw C.err('Jemand anderes war schneller. Versuch es gleich nochmal.', 409, 'conflict');
    throw error;
  }
  return data as number;
}

const seatOf = (tokens: string[], tok: unknown) => (typeof tok === 'string' && tok.length >= 24 ? tokens.indexOf(tok) : -1);
function requireSeat(tokens: string[], tok: unknown) {
  const s = seatOf(tokens, tok);
  if (s < 0) throw C.err('Du sitzt nicht in diesem Raum.', 403, 'notInRoom');
  return s;
}
function requireHost(tokens: string[], tok: unknown) {
  if (requireSeat(tokens, tok) !== 0) throw C.err('Das darf nur der Gastgeber.', 403, 'hostOnly');
}

async function handle(b: any) {
  switch (b.action) {
    case 'create': {
      // tidy up rooms nobody touched for three days
      await sb.from('scopa_rooms').delete().lt('updated_at', new Date(Date.now() - 3 * 864e5).toISOString());
      const n = [2, 3, 4].includes(b.players) ? b.players : 2;
      const players = Array.from({ length: n }, (_, i) =>
        i === 0 ? { name: cleanName(b.name, 'Spieler 1'), ai: false, open: false } : { name: null, ai: false, open: true });
      const G: any = { status: 'lobby', players, settings: cleanSettings(b.settings), teams: false, sides: n, moveNo: 0,
        hands: players.map(() => []), deck: [], piles: [], log: [], msg: 'Warten auf Mitspieler.' };
      let room: any = null;
      for (let i = 0; i < 8 && !room; i++) {
        const { data, error } = await sb.from('scopa_rooms').insert({ code: newCode(), state: C.publicState(G) })
          .select('id,code,state,version').single();
        if (!error) room = data;
        else if (error.code !== '23505') throw error;
      }
      if (!room) throw C.err('Konnte keinen freien Raum-Code finden. Versuch es nochmal.', 500, 'noCode');
      const tokens: string[] = [newToken()];
      const version = await save(room, G, tokens);
      return { code: room.code, roomId: room.id, seat: 0, token: tokens[0], version, state: C.publicState(G) };
    }
    case 'join': {
      const { room, G, tokens } = await load(b.code);
      if (G.status !== 'lobby') throw C.err('In diesem Raum läuft das Spiel schon.', 409, 'started');
      const seat = G.players.findIndex((p: any) => p.open);
      if (seat < 0) throw C.err('Der Raum ist schon voll.', 409, 'full');
      G.players[seat] = { name: cleanName(b.name, `Spieler ${seat + 1}`), ai: false, open: false };
      tokens[seat] = newToken();
      const version = await save(room, G, tokens);
      return { code: room.code, roomId: room.id, seat, token: tokens[seat], version, state: C.publicState(G) };
    }
    case 'leave': {
      const { room, G, tokens } = await load(b.code);
      const seat = requireSeat(tokens, b.token);
      if (G.status !== 'lobby' || seat === 0) return { ok: true };
      G.players[seat] = { name: null, ai: false, open: true };
      tokens[seat] = newToken();
      await save(room, G, tokens);
      return { ok: true };
    }
    case 'seat': {
      const { room, G, tokens } = await load(b.code);
      requireHost(tokens, b.token);
      if (G.status !== 'lobby') throw C.err('Das Spiel läuft schon.', 409, 'started');
      const s = Number(b.seat), p = G.players[s];
      if (!p || s === 0) throw C.err('Diesen Platz gibt es nicht.', 400, 'noSeat');
      if (!p.open && !p.ai) throw C.err('Auf diesem Platz sitzt schon jemand.', 409, 'seatTaken');
      const level = C.LEVELS.includes(b.level) ? b.level : 'normal';
      G.players[s] = b.ai ? { name: p.ai ? p.name : pickCompName(G.players), ai: true, level, open: false } : { name: null, ai: false, open: true };
      const version = await save(room, G, tokens);
      return { ok: true, version, state: C.publicState(G) };
    }
    case 'rename': {
      // the host may correct anyone's name while the room is still waiting
      const { room, G, tokens } = await load(b.code);
      requireHost(tokens, b.token);
      if (G.status !== 'lobby') throw C.err('Das Spiel läuft schon.', 409, 'started');
      const s = Number(b.seat), p = G.players[s];
      if (!p || p.open) throw C.err('Diesen Platz gibt es nicht.', 400, 'noSeat');
      p.name = cleanName(b.name, p.name);
      const version = await save(room, G, tokens);
      return { ok: true, version, state: C.publicState(G) };
    }
    case 'start': {
      const { room, G, tokens } = await load(b.code);
      requireHost(tokens, b.token);
      if (G.status !== 'lobby') throw C.err('Das Spiel läuft schon.', 409, 'started');
      // empty seats are taken by the computer
      G.players.forEach((p: any, i: number) => { if (p.open) G.players[i] = { name: pickCompName(G.players), ai: true, level: 'normal', open: false }; });
      C.setupGame(G);
      const version = await save(room, G, tokens);
      return { ok: true, version, state: C.publicState(G) };
    }
    case 'play': {
      const { room, G, tokens } = await load(b.code);
      const seat = requireSeat(tokens, b.token);
      C.playMove(G, seat, b.card, Array.isArray(b.take) ? b.take : null);
      const version = await save(room, G, tokens);
      return { ok: true, version, state: C.publicState(G), hand: G.hands[seat] };
    }
    case 'ai': {
      const { room, G, tokens } = await load(b.code);
      if (typeof b.moveNo === 'number' && b.moveNo !== (G.moveNo || 0)) return { ok: true, skipped: true };
      if (G.status !== 'play' || !G.players[G.turn].ai) return { ok: true, skipped: true };
      C.playAI(G);
      const version = await save(room, G, tokens);
      return { ok: true, version, state: C.publicState(G) };
    }
    case 'next': {
      const { room, G, tokens } = await load(b.code);
      requireSeat(tokens, b.token);
      if (G.status !== 'roundEnd') return { ok: true, skipped: true };
      C.startRound(G);
      const version = await save(room, G, tokens);
      return { ok: true, version, state: C.publicState(G) };
    }
    case 'again': {
      const { room, G, tokens } = await load(b.code);
      requireHost(tokens, b.token);
      if (G.status !== 'gameEnd') return { ok: true, skipped: true };
      C.setupGame(G);
      const version = await save(room, G, tokens);
      return { ok: true, version, state: C.publicState(G) };
    }
    case 'replace': {
      // the host hands a player's seat to the computer, e.g. after a lost connection
      const { room, G, tokens } = await load(b.code);
      requireHost(tokens, b.token);
      const s = Number(b.seat), p = G.players[s];
      if (!p || s === 0 || p.ai) throw C.err('Diesen Platz kann der Computer nicht übernehmen.', 400, 'cantReplace');
      p.ai = true; p.level = 'normal';
      tokens[s] = newToken();
      const version = await save(room, G, tokens);
      return { ok: true, version, state: C.publicState(G) };
    }
    default:
      throw C.err('Unbekannte Aktion.', 400, 'unknown');
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Nur POST.' }, 405);
  try {
    const body = await req.json();
    return json(await handle(body));
  } catch (e: any) {
    const status = e && e.status ? e.status : 500;
    if (status === 500) console.error(e);
    return json({ error: status === 500 ? 'Serverfehler, bitte nochmal versuchen.' : e.message, code: status === 500 ? 'server' : (e.code || '') }, status);
  }
});
