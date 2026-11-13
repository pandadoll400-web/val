// Accounts: nickname + password stored in the Realtime Database (no Firebase console setup needed).
// Passwords are never stored — only a salted PBKDF2-SHA256 hash (100k rounds) made in the browser.
import { getDb, ref, get, set, runTransaction } from './firebase.js';

export const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;
const SESSION_KEY = 'fc.session';
const ROUNDS = 100000;

const nickKey = (nick) => nick.trim().toLowerCase();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const err = (msg) => { const e = new Error(msg); e.userMsg = msg; return e; };

async function hashPassword(password, saltHex) {
  if (!crypto?.subtle) throw err('이 브라우저에서는 로그인을 지원하지 않습니다');
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ROUNDS }, key, 256);
  return hex(bits);
}

/* ---------- session (who is logged in on this device) ---------- */
let user = null; // { uid, nick }
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(user));
export const currentUser = () => user;

function setSession(u, hash) {
  user = u;
  try {
    if (u) localStorage.setItem(SESSION_KEY, JSON.stringify({ ...u, hash }));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
  emit();
}

/** like onAuthStateChanged: called once at start (auto-login check) and on every login / logout */
let restored = null;
export function watchAuth(fn) {
  listeners.add(fn);
  if (!restored) restored = restoreSession();
  else restored.then(() => fn(user));
  return () => listeners.delete(fn);
}

async function restoreSession() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { /* ignore */ }
  if (s && s.uid && s.nick && s.hash) {
    try {
      const acc = (await get(ref(getDb(), `accounts/${nickKey(s.nick)}`))).val();
      // still the same account and password → auto-login
      if (acc && acc.uid === s.uid && acc.hash === s.hash) { user = { uid: s.uid, nick: acc.nick || s.nick }; emit(); return; }
      if (acc) { setSession(null); return; } // password changed / account replaced
    } catch {
      // offline: trust the device session so progress keeps saving locally
      user = { uid: s.uid, nick: s.nick }; emit(); return;
    }
  }
  user = null;
  emit();
}

export function authMessage(e) {
  if (e?.userMsg) return e.userMsg;
  const m = String(e?.code || e?.message || e);
  if (/permission/i.test(m)) return 'Firebase 권한이 없습니다 — Realtime Database 규칙을 확인하세요';
  if (/network|offline|disconnect/i.test(m)) return '인터넷 연결을 확인하세요';
  return '오류가 발생했습니다 (' + m + ')';
}

export async function login(nick, password) {
  if (!NICK_RE.test(nick || '')) throw err('닉네임은 2~12자 (한글·영문·숫자·_)');
  if (!password) throw err('비밀번호를 입력하세요');
  const acc = (await get(ref(getDb(), `accounts/${nickKey(nick)}`))).val();
  if (!acc) throw err('닉네임 또는 비밀번호가 올바르지 않습니다');
  const h = await hashPassword(password, acc.salt);
  if (h !== acc.hash) throw err('닉네임 또는 비밀번호가 올바르지 않습니다');
  setSession({ uid: acc.uid, nick: acc.nick || nick.trim() }, h);
  return user;
}

/** create the account (nickname claimed atomically); `progress` becomes the account's first save */
export async function signup(nick, password, progress) {
  if (!NICK_RE.test(nick || '')) throw err('닉네임은 2~12자 (한글·영문·숫자·_)');
  if ((password || '').length < 6) throw err('비밀번호는 6자 이상이어야 합니다');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPassword(password, salt);
  const uid = 'u' + hex(crypto.getRandomValues(new Uint8Array(10)));
  const name = nick.trim();
  const res = await runTransaction(ref(getDb(), `accounts/${nickKey(nick)}`), (cur) => {
    if (cur) return undefined; // taken
    return { uid, nick: name, salt, hash, created: Date.now() };
  }, { applyLocally: false });
  if (!res.committed) throw err('이미 사용 중인 닉네임입니다');
  await set(ref(getDb(), `users/${uid}/profile`), { nick: name, created: Date.now() });
  await set(ref(getDb(), `users/${uid}/save`), { ...progress, name });
  setSession({ uid, nick: name }, hash);
  return user;
}

export async function loadAccount(uid) {
  const [p, s] = await Promise.all([get(ref(getDb(), `users/${uid}/profile`)), get(ref(getDb(), `users/${uid}/save`))]);
  return { profile: p.val(), save: s.val() };
}

export function writeSave(uid, data) { return set(ref(getDb(), `users/${uid}/save`), data); }
export async function logout() { setSession(null); }
