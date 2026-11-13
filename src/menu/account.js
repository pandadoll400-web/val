import { watchAuth, login, signup, logout, loadAccount, writeSave, authMessage, NICK_RE } from '../net/auth.js';
import { save, accountData, applyAccountData, setCloudWriter, resetSave, persist } from '../save.js';

const $ = (id) => document.getElementById(id);
const GUEST_KEY = 'fc.guest';
const AUTHED_KEY = 'fc.authed'; // this device has logged in before (auto-login expected)

/** Login window (nickname + password, or guest) and the nickname chip in the top-left of the menu. */
export class AccountUI {
  constructor({ ui }) {
    this.ui = ui;
    this.user = null;
    this.nick = null;
    this.tab = 'login';
    this.busy = false;
    this.ready = false;

    $('account-chip').onclick = () => this.open();
    document.querySelectorAll('#account .login-tabs button').forEach((b) => (b.onclick = () => this.setTab(b.dataset.tab)));
    $('login-go').onclick = () => this.submit();
    $('login-guest').onclick = () => this.guest();
    $('login-switch').onclick = () => this.showForm();
    $('login-logout').onclick = () => this.doLogout();
    $('login-close').onclick = () => this.close();
    for (const id of ['login-nick-in', 'login-pw', 'login-pw2']) {
      $(id).addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.submit(); });
    }

    // never logged in on this device and not a guest → show the login window right away (don't wait for Firebase)
    if (!localStorage.getItem(GUEST_KEY) && !localStorage.getItem(AUTHED_KEY)) this.open();
    let first = true;
    watchAuth(async (user) => {
      this.user = user;
      if (user) {
        try {
          const acc = await loadAccount(user.uid);
          if (acc.save) applyAccountData(acc.save);
          else await writeSave(user.uid, accountData());
          this.nick = acc.profile?.nick || acc.save?.name || save.name;
          save.name = this.nick;
          persist(true);
          localStorage.setItem(AUTHED_KEY, '1');
          setCloudWriter((d) => writeSave(user.uid, d).catch((e) => console.warn('cloud save', e)));
        } catch (e) {
          console.warn(e);
          this.ui.toast(authMessage(e));
        }
        this.close();
      } else {
        this.nick = null;
        setCloudWriter(null);
        localStorage.removeItem(AUTHED_KEY);
        if (first && !localStorage.getItem(GUEST_KEY)) this.open();
      }
      first = false;
      this.ready = true;
      this.updateChip();
      this.ui.refresh();
    });
  }

  get visible() { return !$('account').classList.contains('hidden'); }

  updateChip() {
    $('account-name').textContent = this.user ? this.nick || '…' : '게스트 · 로그인';
    $('account-chip').classList.toggle('guest', !this.user);
  }

  open() {
    $('account').classList.remove('hidden');
    if (this.user) {
      $('login-signed').classList.remove('hidden');
      $('login-form').classList.add('hidden');
      $('login-nick').textContent = this.nick || '';
    } else this.showForm();
  }

  showForm() {
    $('login-signed').classList.add('hidden');
    $('login-form').classList.remove('hidden');
    $('login-err').textContent = '';
    this.setTab(this.tab);
    setTimeout(() => $('login-nick-in').focus(), 50);
  }

  close() { $('account').classList.add('hidden'); }

  setTab(tab) {
    this.tab = tab;
    document.querySelectorAll('#account .login-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('login-pw2').classList.toggle('hidden', tab !== 'signup');
    $('login-go').textContent = tab === 'signup' ? '회원가입' : '로그인';
    $('login-pw').autocomplete = tab === 'signup' ? 'new-password' : 'current-password';
    $('login-err').textContent = '';
  }

  async submit() {
    if (this.busy) return;
    const nick = $('login-nick-in').value.trim(), pw = $('login-pw').value, pw2 = $('login-pw2').value;
    const errEl = $('login-err');
    if (!NICK_RE.test(nick)) { errEl.textContent = '닉네임은 2~12자 (한글·영문·숫자·_)'; return; }
    if (this.tab === 'signup' && pw !== pw2) { errEl.textContent = '비밀번호 확인이 일치하지 않습니다'; return; }
    this.busy = true;
    $('login-go').disabled = true;
    errEl.textContent = this.tab === 'signup' ? '계정을 만드는 중…' : '로그인 중…';
    try {
      if (this.tab === 'signup') {
        // this device's current progress becomes the new account's progress
        await signup(nick, pw, { ...accountData(), name: nick });
        this.ui.toast(`환영합니다, ${nick}님! 진행 상황이 계정에 저장됩니다`);
      } else {
        await login(nick, pw);
        this.ui.toast(`${nick}님, 다시 오신 걸 환영합니다`);
      }
      localStorage.removeItem(GUEST_KEY);
      $('login-pw').value = $('login-pw2').value = '';
      errEl.textContent = '';
    } catch (e) {
      console.warn(e);
      errEl.textContent = authMessage(e);
    }
    this.busy = false;
    $('login-go').disabled = false;
  }

  guest() {
    localStorage.setItem(GUEST_KEY, '1');
    this.close();
    this.ui.toast('게스트로 시작합니다 — 진행은 이 기기에만 저장돼요');
  }

  async doLogout() {
    await logout().catch(() => {});
    resetSave();
    this.ui.refresh();
    this.showForm();
    this.ui.toast('로그아웃했습니다');
  }
}
