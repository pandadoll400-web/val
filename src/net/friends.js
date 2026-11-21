// Friends, presence and room invites (logged-in accounts only), all in the Realtime Database:
//   friendReq/{toUid}/{fromUid} = { nick, at }
//   friends/{uid}/{otherUid}    = { nick, since }      (written on both sides)
//   presence/{uid}              = { online, at }       (onDisconnect → offline)
//   invites/{toUid}/{fromUid}   = { nick, code, at }
//   ranks/{uid}                 = { nick, rp, at }     (leaderboard)
import { getDb, ref, get, set, update, remove, onValue, onDisconnect, serverTimestamp } from './firebase.js';
import { currentUser, watchAuth } from './auth.js';

const db = () => getDb();
const me = () => currentUser();

/* ---------- presence ---------- */
let presenceUid = null;
export function startPresence() {
  watchAuth(async (u) => {
    if (presenceUid && presenceUid !== u?.uid) set(ref(db(), `presence/${presenceUid}`), { online: false, at: serverTimestamp() }).catch(() => {});
    presenceUid = u?.uid || null;
    if (!u) return;
    const r = ref(db(), `presence/${u.uid}`);
    try {
      await onDisconnect(r).set({ online: false, at: serverTimestamp() });
      await set(r, { online: true, at: serverTimestamp() });
    } catch (e) { console.warn('presence', e); }
  });
}

/* ---------- lookups ---------- */
/** { uid, nick } of an account by nickname, or null */
export async function findUser(nick) {
  const acc = (await get(ref(db(), `accounts/${String(nick).trim().toLowerCase()}`))).val();
  return acc ? { uid: acc.uid, nick: acc.nick || nick } : null;
}

/* ---------- requests ---------- */
export async function sendRequest(nick) {
  const u = me();
  if (!u) throw new Error('로그인이 필요해요');
  const other = await findUser(nick);
  if (!other) throw new Error('그런 닉네임이 없어요');
  if (other.uid === u.uid) throw new Error('나 자신은 추가할 수 없어요');
  const already = (await get(ref(db(), `friends/${u.uid}/${other.uid}`))).val();
  if (already) throw new Error('이미 친구예요');
  // they already asked me → accept right away
  const theirs = (await get(ref(db(), `friendReq/${u.uid}/${other.uid}`))).val();
  if (theirs) { await accept(other.uid, other.nick); return 'accepted'; }
  await set(ref(db(), `friendReq/${other.uid}/${u.uid}`), { nick: u.nick, at: serverTimestamp() });
  return 'sent';
}

export async function accept(uid, nick) {
  const u = me();
  if (!u) return;
  await update(ref(db()), {
    [`friends/${u.uid}/${uid}`]: { nick, since: serverTimestamp() },
    [`friends/${uid}/${u.uid}`]: { nick: u.nick, since: serverTimestamp() },
    [`friendReq/${u.uid}/${uid}`]: null,
  });
}
export const decline = (uid) => me() && remove(ref(db(), `friendReq/${me().uid}/${uid}`));
export async function removeFriend(uid) {
  const u = me();
  if (!u) return;
  await update(ref(db()), { [`friends/${u.uid}/${uid}`]: null, [`friends/${uid}/${u.uid}`]: null });
}

/* ---------- invites ---------- */
export function invite(uid, code) {
  const u = me();
  if (!u || !code) return Promise.resolve();
  return set(ref(db(), `invites/${uid}/${u.uid}`), { nick: u.nick, code, at: serverTimestamp() });
}
export const clearInvite = (fromUid) => me() && remove(ref(db(), `invites/${me().uid}/${fromUid}`));

/* ---------- live state ---------- */
/**
 * Subscribe to my friends (with presence and rank), requests and invites.
 * cb({ friends: [{uid, nick, online, rp}], requests: [{uid, nick}], invites: [{uid, nick, code, at}] })
 */
export function watchFriends(cb) {
  let offs = [];
  const state = { friends: {}, requests: [], invites: [], presence: {}, ranks: {} };
  const emit = () => cb({
    friends: Object.entries(state.friends).map(([uid, f]) => ({ uid, nick: f.nick, online: !!state.presence[uid]?.online, rp: state.ranks[uid]?.rp || 0 }))
      .sort((a, b) => b.online - a.online || a.nick.localeCompare(b.nick)),
    requests: state.requests,
    invites: state.invites,
  });
  const stopAll = () => { offs.forEach((f) => f()); offs = []; };
  const unAuth = watchAuth((u) => {
    stopAll();
    Object.assign(state, { friends: {}, requests: [], invites: [], presence: {}, ranks: {} });
    emit();
    if (!u) return;
    const watched = {};
    offs.push(onValue(ref(db(), `friends/${u.uid}`), (s) => {
      state.friends = s.val() || {};
      for (const uid of Object.keys(state.friends)) {
        if (watched[uid]) continue;
        watched[uid] = true;
        offs.push(onValue(ref(db(), `presence/${uid}`), (p) => { state.presence[uid] = p.val(); emit(); }, () => {}));
        offs.push(onValue(ref(db(), `ranks/${uid}`), (p) => { state.ranks[uid] = p.val(); emit(); }, () => {}));
      }
      emit();
    }, (e) => console.warn('friends', e)));
    offs.push(onValue(ref(db(), `friendReq/${u.uid}`), (s) => {
      state.requests = Object.entries(s.val() || {}).map(([uid, r]) => ({ uid, nick: r.nick }));
      emit();
    }, () => {}));
    offs.push(onValue(ref(db(), `invites/${u.uid}`), (s) => {
      state.invites = Object.entries(s.val() || {}).map(([uid, r]) => ({ uid, nick: r.nick, code: r.code, at: r.at || 0 }));
      emit();
    }, () => {}));
  });
  return () => { stopAll(); unAuth(); };
}

/* ---------- leaderboard ---------- */
export function writeRank(rp) {
  const u = me();
  if (!u) return Promise.resolve();
  return set(ref(db(), `ranks/${u.uid}`), { nick: u.nick, rp, at: serverTimestamp() }).catch((e) => console.warn('rank', e));
}
/** top N by RP, best first (sorted here: no database index needed) */
export async function topRanks(n = 20) {
  const all = (await get(ref(db(), 'ranks'))).val() || {};
  return Object.entries(all).map(([uid, v]) => ({ uid, nick: v?.nick || '?', rp: +v?.rp || 0 })).sort((a, b) => b.rp - a.rp).slice(0, n);
}
