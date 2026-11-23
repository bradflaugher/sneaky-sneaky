// DOM HUD and menu screens. The game calls in; buttons call back out through
// the `on` handlers object.

import { vaultEntries, vaultSummary } from '../game/save.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['title', 'pause', 'fail', 'clear', 'vault', 'custom', 'setup'];

export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class UI {
  constructor(on) {
    this.on = on;
    this.touch = false;
    this._toastT = 0;
    this._bannerT = 0;
    const click = (id, name) => $(id).addEventListener('click', () => on[name]?.());
    click('btn-start', 'start');
    click('btn-agent', 'agent');
    click('btn-agent2', 'agent');
    click('btn-vault', 'vault');
    click('btn-setup', 'setup');
    click('btn-setup2', 'setup');
    click('btn-setup-done', 'back');
    click('btn-resume', 'resume');
    click('btn-restart', 'retry');
    click('btn-mute', 'mute');
    click('btn-style', 'style');
    click('btn-quit', 'quit');
    click('btn-retry', 'retry');
    click('btn-fail-quit', 'quit');
    click('btn-next', 'next');
    click('btn-clear-quit', 'quit');
    click('btn-vault-back', 'back');
    click('btn-custom-done', 'back');
    click('btn-pause', 'pause');
    if (window.matchMedia('(pointer: coarse)').matches) this.setTouch(true);
  }

  setTouch(on) {
    if (this.touch === on) return;
    this.touch = on;
    document.body.classList.toggle('touch', on);
  }

  show(name) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    for (const s of SCREENS) $(`screen-${s}`).classList.toggle('hidden', s !== name);
  }

  setHud(visible) {
    $('hud').classList.toggle('hidden', !visible);
  }

  setTitle({ agent, seed, setupLine }) {
    $('agent-line').textContent = `AGENT: ${agent.codename.toUpperCase()}`;
    $('seed-line').textContent = `SEED: ${seed}`;
    this.setSetupLine(setupLine);
  }

  setSetupLine(line, summary = '') {
    $('setup-line').textContent = line;
    $('setup-line2').textContent = line;
    $('setup-summary').textContent = summary;
  }

  /** Full-screen "generating" card; resolves after the browser has painted it. */
  loading(text) {
    $('loading-text').textContent = text;
    $('loading').classList.remove('hidden');
    return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 20)));
  }

  loaded() {
    $('loading').classList.add('hidden');
  }

  setStyle(name) {
    $('btn-style').textContent = `VISUAL STYLE: ${name.toUpperCase()}`;
  }

  setMute(muted) {
    $('btn-mute').textContent = `SOUND: ${muted ? 'OFF' : 'ON'}`;
  }

  setObjective({ tag, text, sub, done }) {
    $('room-tag').textContent = tag;
    $('obj-text').textContent = text;
    $('obj-sub').textContent = sub;
    $('objective').classList.toggle('done', !!done);
  }

  setStats(time, knockouts) {
    const t = fmtTime(time);
    if (this._lastT !== t) {
      this._lastT = t;
      $('timer').textContent = t;
    }
    if (this._lastKo !== knockouts) {
      this._lastKo = knockouts;
      $('ko').textContent = `💤 ${knockouts}`;
    }
  }

  /** Context action: null or { label, key, choke }. */
  setAction(a) {
    const sig = a ? a.label : '';
    if (sig === this._lastAction) return;
    this._lastAction = sig;
    const btn = $('btn-action');
    btn.classList.toggle('ready', !!a);
    btn.classList.toggle('choke', !!a && a.label === 'CHOKE');
    $('btn-action-label').textContent = a ? a.label : 'ACTION';
    const p = $('prompt');
    p.classList.toggle('on', !!a);
    if (a) p.innerHTML = `<b>E</b>${a.text}`;
  }

  setCrouch(on) {
    $('btn-crouch').classList.toggle('active', on);
  }

  setKnockReady(ready) {
    $('btn-knock').classList.toggle('cooling', !ready);
  }

  banner(eyebrow, title, sub, seconds = 3.2) {
    $('banner-eyebrow').textContent = eyebrow;
    $('banner-title').textContent = title;
    $('banner-sub').textContent = sub;
    $('banner').classList.add('on');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => $('banner').classList.remove('on'), seconds * 1000);
  }

  hideBanner() {
    clearTimeout(this._bannerT);
    $('banner').classList.remove('on');
  }

  toast(text, seconds = 2.2) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('on'), seconds * 1000);
  }

  flash() {
    const f = $('flash');
    f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 120);
  }

  showFail(reason) {
    $('fail-reason').textContent = reason;
    this.show('fail');
  }

  showClear({ rank, ghost, time, par, knockouts, closeCalls, loot, venue, isNew, streak, meta }) {
    $('clear-meta').textContent = meta || '';
    const r = $('rank');
    r.textContent = rank;
    r.className = `rank ${rank}`;
    $('clear-loot').textContent = loot.name;
    $('clear-tag').textContent = `${loot.rarity} · ${loot.serial}`;
    $('clear-tag').className = `meta-line rarity-${loot.rarity}`;
    $('clear-flavor').textContent = `${loot.tagline} Lifted from ${venue}.`;
    $('st-time').textContent = fmtTime(time);
    $('st-par').textContent = fmtTime(par);
    $('st-ko').textContent = String(knockouts);
    $('st-cc').textContent = String(closeCalls);
    const badges = $('badges');
    badges.textContent = '';
    const badge = (text, gold) => {
      const b = document.createElement('span');
      b.className = `badge${gold ? ' gold' : ''}`;
      b.textContent = text;
      badges.append(b);
    };
    if (ghost) badge('👻 GHOST BONUS', false);
    if (ghost && closeCalls === 0) badge('NEVER EVEN A "?"', false);
    if (isNew) badge(loot.rarity === 'SIGNATURE' ? 'SIGNATURE PIECE' : 'NEW IN VAULT', true);
    if (streak > 1) badge(`${streak} ROOM STREAK`, true);
    this.show('clear');
  }

  /** The vault can hold hundreds of unique artifacts, so it filters and pages. */
  showVault(save) {
    const sum = vaultSummary(save);
    const all = vaultEntries(save);
    const s = save.stats;
    $('vault-count').textContent = `${sum.unique} unique ${sum.unique === 1 ? 'trophy' : 'trophies'}`;
    $('vault-stats').textContent = `${sum.heists} heists pulled · ${sum.by.SIGNATURE} / ${sum.signatureTotal} signature pieces · ${s.ghosts} ghost runs · best streak ${s.bestStreak} · ${s.knockouts} naps administered`;
    const list = $('vault-list');
    const filters = $('vault-filters');
    const PAGE = 36;
    let filter = 'ALL';
    let shown = PAGE;
    const el = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    };
    const draw = () => {
      filters.textContent = '';
      for (const f of ['ALL', 'SIGNATURE', 'ABSURD', 'RARE', 'CONTRABAND']) {
        const n = f === 'ALL' ? sum.unique : sum.by[f] || 0;
        const b = el('button', `chip${filter === f ? ' sel' : ''}`, `${f} ${n}`);
        b.addEventListener('click', () => {
          filter = f;
          shown = PAGE;
          draw();
        });
        filters.append(b);
      }
      const items = filter === 'ALL' ? all : all.filter((e) => e.rarity === filter);
      list.textContent = '';
      if (!items.length) list.append(el('div', 'vault-empty', all.length ? 'Nothing filed under that yet.' : 'Empty shelves. Everything out there is still poorly guarded.'));
      const frag = document.createDocumentFragment();
      for (const e of items.slice(0, shown)) {
        const d = el('div', `vault-item rarity-${e.rarity}`);
        d.append(el('span', 'rar', e.rarity), el('b', '', e.name), el('span', 'tagline', e.tagline || ''));
        const where = [e.serial, e.sector ? `SECTOR ${String(e.sector).padStart(2, '0')}` : '', `BEST ${e.best}`, e.count > 1 ? `×${e.count}` : ''].filter(Boolean).join(' · ');
        d.append(el('span', 'meta', where));
        if (e.venue) d.append(el('span', 'venue', e.venue));
        frag.append(d);
      }
      list.append(frag);
      if (items.length > shown) {
        const more = el('button', 'chip more', `SHOW ${Math.min(PAGE, items.length - shown)} MORE OF ${items.length - shown}`);
        more.addEventListener('click', () => {
          shown += PAGE;
          draw();
        });
        list.append(more);
      }
    };
    draw();
    this.show('vault');
  }
}
