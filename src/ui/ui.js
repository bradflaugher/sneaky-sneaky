// DOM HUD and menu screens. The game calls in; buttons call back out through
// the `on` handlers object.

import { vaultSummary, modeCaseFiles, entryModes, caseFileCards, catalogClosed } from '../game/save.js';
import { CASE_CATALOG } from '../core/caseCatalog.js';
import { THEMES } from '../core/themes.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['title', 'pause', 'fail', 'clear', 'vault', 'setup'];

export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class UI {
  constructor(on) {
    this.on = on;
    this.touch = false;
    this._toastT = 0;
    this._bannerT = 0;
    const click = (id, name) => $(id).addEventListener('click', () => on[name]?.());
    click('btn-start', 'start');
    click('btn-infinite', 'infinite');
    click('btn-reroll', 'reroll');
    click('btn-reroll-pause', 'reroll');
    click('btn-reroll-clear', 'reroll');
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
    click('btn-pause', 'pause');
    click('btn-fullscreen', 'fullscreen');
    click('btn-fullscreen-title', 'fullscreen');
    click('btn-fullscreen-pause', 'fullscreen');
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

  /**
   * Title screen. `dossiers` is modeCaseFiles(save): the Endless Run button
   * wears its mini case-file summary once that mode has been played.
   * `rolled` replays the little stamp animation on the seed after NEW SEED.
   */
  setTitle({ seed, setupLine, dossiers = [], rolled = false }) {
    const line = $('seed-line');
    line.textContent = `SEED: ${seed}`;
    if (rolled) {
      line.classList.remove('rolled');
      void line.offsetWidth; // restart the animation
      line.classList.add('rolled');
    }
    this.setSetupLine(setupLine);
    const inf = dossiers.find((d) => d.id === 'infinite');
    const pill = $('infinite-pill');
    pill.textContent = inf && inf.summary ? `${inf.summary}${inf.bestStreak > 1 ? ` · Streak ${inf.bestStreak}` : ''}` : '';
    pill.classList.toggle('hidden', !pill.textContent);
  }

  /**
   * Reflect the run mode: the title highlights the mode Enter will start, and
   * the NEW SEED / REROLL buttons on the pause and clear screens only exist
   * during an Endless Run. A Case File is one room, so its clear screen
   * leads back to the Case Files.
   */
  setMode(mode, inRun) {
    const infinite = mode === 'infinite';
    document.body.classList.toggle('mode-infinite', infinite && inRun);
    $('btn-infinite').classList.toggle('preferred', infinite);
    $('btn-next').firstChild.textContent = mode === 'case' ? 'CASE FILES ' : infinite ? 'NEXT ROOM ' : 'NEXT ISSUE ';
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

  setFullscreen(supported, active) {
    const hudBtn = $('btn-fullscreen');
    const titleBtn = $('btn-fullscreen-title');
    const pauseBtn = $('btn-fullscreen-pause');
    hudBtn.classList.toggle('hidden', !supported);
    titleBtn.classList.toggle('hidden', !supported);
    pauseBtn.classList.toggle('hidden', !supported);
    if (!supported) return;
    hudBtn.classList.toggle('active', active);
    hudBtn.setAttribute('aria-pressed', String(active));
    hudBtn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    hudBtn.title = active ? 'Exit fullscreen' : 'Fullscreen';
    hudBtn.textContent = active ? '⤢' : '⛶';
    titleBtn.setAttribute('aria-pressed', String(active));
    titleBtn.textContent = active ? '⤢ EXIT FULLSCREEN' : '⛶ FULLSCREEN';
    pauseBtn.textContent = `FULLSCREEN: ${active ? 'ON' : 'OFF'}`;
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
    btn.classList.toggle('long', !!a && a.label.length > 8);
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

  banner(eyebrow, title, sub, seconds = 1.8) {
    $('banner-eyebrow').textContent = eyebrow;
    $('banner-title').textContent = title;
    $('banner-sub').textContent = sub;
    $('banner').classList.add('on');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => $('banner').classList.remove('on'), seconds * 1000);
  }

  /** Show the key legend, then let it fade so it never sits in a screenshot. */
  hintKeys(seconds = 7) {
    const k = $('keys-hint');
    k.classList.remove('faded');
    clearTimeout(this._keysT);
    this._keysT = setTimeout(() => k.classList.add('faded'), seconds * 1000);
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

  showClear({ rank, ghost, time, par, knockouts, closeCalls, loot, venue, isNew, streak, meta, infinite }) {
    $('clear-meta').textContent = meta || '';
    const r = $('rank');
    r.textContent = rank;
    r.className = `rank ${rank}`;
    $('clear-got').textContent = loot.mission ? loot.mission.past : 'ACQUIRED';
    $('clear-loot').textContent = loot.name;
    $('clear-tag').textContent = `${loot.rarity} · ${loot.serial}`;
    $('clear-tag').className = `meta-line rarity-${loot.rarity}`;
    $('clear-flavor').textContent = `${loot.tagline} ${venue}.`;
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
    if (isNew) badge(loot.rarity === 'SIGNATURE' ? 'SIGNATURE CASE' : 'NEW CASE FILE', true);
    if (infinite) badge(`∞ ENDLESS STREAK ×${streak}`, true);
    else if (streak > 1) badge(`${streak} ROOM STREAK`, true);
    this.show('clear');
  }

  /**
   * Case Files. Up top, a dossier folder for every game type; clicking one
   * filters the list to the cases closed in that game type. With ALL MODES
   * the grid is the whole playable catalog (12 cases of every rarity, each
   * with a PLAY CASE button) followed by every other case the player has
   * closed, so no rarity chip is ever empty. The list filters and pages.
   */
  showVault(save) {
    const sum = vaultSummary(save);
    const dossiers = modeCaseFiles(save);
    const s = save.stats;
    $('vault-count').textContent = `${sum.unique} case ${sum.unique === 1 ? 'file' : 'files'} closed · ${CASE_CATALOG.length} to play`;
    $('vault-stats').textContent = `${catalogClosed(save)} / ${CASE_CATALOG.length} catalog cases · ${sum.heists} missions run · ${sum.by.SIGNATURE} / ${sum.signatureTotal} signature targets · ${s.ghosts} ghost runs · best streak ${s.bestStreak} · ${s.knockouts} naps administered`;
    const list = $('vault-list');
    const filters = $('vault-filters');
    const modes = $('vault-modes');
    const allModes = $('vault-all-modes');
    const PAGE = 48;
    let filter = 'ALL';
    let mode = null; // a game-type id, or null for all modes
    let shown = PAGE;
    const el = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    };
    const pickMode = (id) => {
      mode = id;
      shown = PAGE;
      draw();
    };
    allModes.onclick = () => pickMode(null);
    const drawModes = () => {
      allModes.classList.toggle('sel', mode === null);
      modes.textContent = '';
      for (const d of dossiers) {
        const card = el('button', `mini-file mode-${d.id}${mode === d.id ? ' sel' : ''}${d.rooms ? '' : ' unopened'}`);
        card.setAttribute('aria-pressed', String(mode === d.id));
        card.title = d.blurb;
        card.append(el('span', 'tab', d.label));
        card.append(el('span', `stamp${d.bestRank ? ` ${d.bestRank}` : ''}`, d.bestRank || '—'));
        card.append(el('b', '', String(d.rooms)), el('span', 'unit', d.rooms === 1 ? 'room cleared' : 'rooms cleared'));
        const facts = el('span', 'facts');
        facts.append(el('span', '', `STREAK ${d.bestStreak}`), el('span', '', `👻 ${d.ghosts}`), el('span', '', `THEMES ${d.themes}/${d.themesTotal}`));
        card.append(facts);
        // clicking the open folder again closes it
        card.addEventListener('click', () => pickMode(mode === d.id ? null : d.id));
        modes.append(card);
      }
    };
    const modeTags = (file) => {
      const tags = file ? entryModes(file) : [];
      if (!tags.length) return null;
      const row = el('span', 'modes');
      for (const id of tags) row.append(el('span', `mode-tag mode-${id}`, dossiers.find((x) => x.id === id)?.label || id.toUpperCase()));
      return row;
    };
    /** One card: a playable catalog case (open or closed), or a closed procedural case. */
    const cardFor = ({ rarity, entry, file }) => {
      const d = el('div', `vault-item rarity-${rarity}${entry ? ' case-card' : ''}${file ? ' closed' : ' open'}`);
      const top = el('span', 'case-top');
      top.append(el('span', 'rar', rarity));
      if (entry) top.append(el('span', `case-stamp ${file ? 'closed' : 'open'}`, file ? `CLOSED · BEST ${file.best}` : 'OPEN'));
      d.append(top);
      if (entry) {
        const { loot } = entry;
        d.append(el('b', '', loot.name), el('span', 'tagline', loot.tagline));
        d.append(el('span', 'meta', [`${loot.mission.verb} IT`, loot.serial, file && file.count > 1 ? `×${file.count}` : ''].filter(Boolean).join(' · ')));
        d.append(el('span', 'meta where', `${THEMES[entry.themeId].name} · ${entry.layoutStyle.toUpperCase()} LAYOUT · TIER ${String(entry.level).padStart(2, '0')}`));
        d.append(el('span', 'venue', entry.venue));
      } else {
        d.append(el('b', '', file.name), el('span', 'tagline', file.tagline || ''));
        const where = [file.verb || 'RECOVERED', file.serial, file.sector ? `SECTOR ${String(file.sector).padStart(2, '0')}` : '', `BEST ${file.best}`, file.count > 1 ? `×${file.count}` : ''].filter(Boolean).join(' · ');
        d.append(el('span', 'meta', where));
        if (file.venue) d.append(el('span', 'venue', file.venue));
      }
      const tags = modeTags(file);
      if (tags) d.append(tags);
      if (entry) {
        const play = el('button', `chip play-case${file ? ' replay' : ''}`, file ? 'REPLAY' : 'PLAY CASE');
        play.setAttribute('aria-label', `${file ? 'Replay' : 'Play'} case ${entry.caseId}: ${entry.loot.name}`);
        play.addEventListener('click', () => this.on.playCase?.(entry));
        d.append(play);
      }
      return d;
    };
    const draw = () => {
      drawModes();
      const inMode = caseFileCards(save, mode);
      filters.textContent = '';
      for (const f of ['ALL', 'SIGNATURE', 'ABSURD', 'RARE', 'CONTRABAND']) {
        const n = f === 'ALL' ? inMode.length : inMode.filter((c) => c.rarity === f).length;
        const b = el('button', `chip${filter === f ? ' sel' : ''}`, `${f} ${n}`);
        b.addEventListener('click', () => {
          filter = f;
          shown = PAGE;
          draw();
        });
        filters.append(b);
      }
      const items = filter === 'ALL' ? inMode : inMode.filter((c) => c.rarity === filter);
      list.textContent = '';
      const label = mode ? dossiers.find((d) => d.id === mode).label : '';
      if (!items.length) list.append(el('div', 'vault-empty', !inMode.length ? `No case files closed in ${label} yet. Pick ALL MODES for the full catalog of playable cases.` : 'Nothing filed under that yet.'));
      const frag = document.createDocumentFragment();
      for (const c of items.slice(0, shown)) frag.append(cardFor(c));
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
