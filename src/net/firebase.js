// Firebase Realtime Database connection (bundled into the single HTML file, so it works from file://).
import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, set, get, update, remove, push, onValue, onChildAdded, onChildChanged, onChildRemoved, off,
  onDisconnect, runTransaction, serverTimestamp, query, orderByChild, startAt,
} from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyDsRYdEQXCiqW166GB4SLSuFFk4fDq9HrA',
  authDomain: 'claude-7a320.firebaseapp.com',
  databaseURL: 'https://claude-7a320-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'claude-7a320',
  storageBucket: 'claude-7a320.firebasestorage.app',
  messagingSenderId: '472198873478',
  appId: '1:472198873478:web:6acc2dd14420430b6eec07',
};

let app = null, db = null;
export function getApp() { if (!app) app = initializeApp(firebaseConfig); return app; }
export function getDb() {
  if (!db) db = getDatabase(getApp());
  return db;
}

/** server clock offset (ms) so both players agree on start times */
let offset = 0;
export function watchServerOffset() {
  onValue(ref(getDb(), '.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });
}
export const serverNow = () => Date.now() + offset;

/** stable id for this browser tab (sessionStorage → two tabs on one PC are two players) */
export function myUid() {
  let id = null;
  try { id = sessionStorage.getItem('fc.uid'); } catch { /* ignore */ }
  if (!id) {
    id = 'p' + Math.random().toString(36).slice(2, 10);
    try { sessionStorage.setItem('fc.uid', id); } catch { /* ignore */ }
  }
  return id;
}

export const isPermissionError = (e) => /permission/i.test(String(e?.code || e?.message || e));

export {
  ref, set, get, update, remove, push, onValue, onChildAdded, onChildChanged, onChildRemoved, off,
  onDisconnect, runTransaction, serverTimestamp, query, orderByChild, startAt,
};
