// The game: state machine, simulation and rendering glue.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { RNG, randomSeedString } from '../core/rng.js';
import { FLOOR, cellAt, hasLineOfSight, findPath, nearestFloorCell } from '../core/grid.js';
import { generateRoom } from '../core/generator.js';
import { poseAt, angDiff } from '../core/patrol.js';
import { canSee, canChoke, isBumping, detectRate, rankFor } from '../core/stealth.js';
import { THEMES, THEME_IDS } from '../core/themes.js';
import { resolveMods, tierFor, describeRun, describeSetup, setupFromParams, setupToParams, normalizeSetup } from '../core/difficulty.js';

import { buildWorld } from '../render/world.js';
import { buildCharacter, animateCharacter, settleCharacter, addSilhouette, guardSpec, agentSpec, yawOf } from '../render/character.js';
import { createCone } from '../render/cones.js';
import { toon, inkEdges } from '../render/toon.js';
import { createFx } from '../render/fx.js';
import { createComicPass, VISUAL_STYLES } from '../render/comicPass.js';

import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { loadSave, storeSave, recordLoot } from './save.js';
import { UI } from '../ui/ui.js';
import { Radar } from '../ui/radar.js';
import { Customizer } from '../ui/customizer.js';
import { SetupPanel } from '../ui/setup.js';

const PLAYER_R = 0.28;
const RUN_SPEED = 4.4;
const TIPTOE_SPEED = 1.7;
const CROUCH_SPEED = 2.5;
const CHOKE_TIME = 0.55;
const KNOCK_RADIUS = 7.5;
const KNOCK_COOLDOWN = 2.4;
const FOOTSTEP_RADIUS = 2.6;
const INVESTIGATE_SPEED = 1.9;
const AWAKE = new Set(['patrol', 'suspicious', 'investigate', 'look', 'return']);

const TIPS = [
  'Crouch behind waist-high cover and their cones pass right over you.',
  'Knock to lure a guard over, then slip past where they were.',
  'Glowing vents link rooms. Crawl through to skip the long way round.',
  'Red beams mean find the switch, or find a vent around them.',
  'Sneak up directly behind a guard for a sleeper hold. Ghosts skip this.',
];
const SPOTTED = [
  'spotted you. Rude, but fair.',
  'saw everything. Everything.',
  'has questions. So many questions.',
  'noticed a whole person where no person should be.',
  'made eye contact. It was awkward for both of you.',
];

function approachAngle(cur, target, maxStep) {
  const d = angDiff(cur, target);
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}

export class Game {
  constructor(canvas) {
    const params = new URLSearchParams(location.search);
    this.params = params;
    this.canvas = canvas;
    this.save = loadSave();
    this.lowPower = params.has('lowpower') || window.matchMedia('(pointer: coarse)').matches;
    this.fixedSeed = params.get('seed');
    this.levelOffset = Math.max(0, (parseInt(params.get('level') || '1', 10) || 1) - 1);
    // URL params win over saved settings, so shared links reproduce a setup.
    this.setup = setupFromParams(params, this.save.settings.setup);
    if (this.setup.theme !== 'random' && !THEMES[this.setup.theme]) this.setup.theme = 'random';
    this.mods = resolveMods(this.setup);
    this.save.settings.setup = { ...this.setup };

    this.audio = new GameAudio();
    this.audio.muted = !!this.save.settings.mute;
    this.input = new Input(canvas, {
      stick: document.getElementById('stick'),
      knob: document.getElementById('stick-knob'),
      buttons: { 'btn-action': 'action', 'btn-crouch': 'crouch', 'btn-knock': 'knock', 'btn-cam': 'cam' },
    });
    this.input.onFirstGesture = () => this.audio.unlock();
    this.ui = new UI({
      start: () => this.startRun(),
      agent: () => this.openCustomizer(),
      vault: () => this.openVault(),
      setup: () => this.openSetup(),
      resume: () => this.resume(),
      retry: () => this.retry(),
      mute: () => this.toggleMute(),
      quit: () => this.enterTitle(),
      next: () => this.nextRoom(),
      back: () => this.back(),
      pause: () => this.pause(),
      style: () => this.toggleStyle(),
    });
    this.ui.setMute(this.audio.muted);
    document.addEventListener('click', (e) => {
      if (e.target instanceof HTMLButtonElement) {
        this.audio.unlock();
        this.audio.ui();
      }
    });
    this.setupPanel = new SetupPanel((setup) => this.applySetup(setup));
    this.radar = new Radar(document.getElementById('radar'));
    this.customizer = new Customizer((agent, rebuild) => {
      this.save.agent = agent;
      storeSave(this.save);
      if (rebuild) this.rebuildAgent();
    });

    // ---- renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.3, 700);
    this.camRig = new CameraRig(this.camera);
    this.camRig.setMode(this.save.settings.cam === 'tactical' ? 'tactical' : 'chase', true);
    // Everything goes through the comic pass; bloom and MSAA are desktop extras.
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: this.lowPower ? 0 : 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    if (!this.lowPower && !params.has('nobloom')) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 1.0);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.comic = createComicPass();
    if (!VISUAL_STYLES[this.save.settings.style]) this.save.settings.style = 'ps1';
    this.comic.setStyle(this.save.settings.style);
    this.composer.addPass(this.comic.pass);
    this.ui.setStyle(VISUAL_STYLES[this.save.settings.style].name);
    // A cold key that follows the agent, so they always read against the dark.
    this.agentLight = new THREE.PointLight(0xbfe8ff, 9, 5.5, 1.6);
    this.scene.add(this.agentLight);
    this.buildPreview();

    this.state = 'title';
    this.time = 0;
    this.run = { seed: this.fixedSeed || randomSeedString(), roomNo: 1, streak: 0 };
    this.lastTheme = null;
    this.guards = [];
    this.player = { x: 0, z: 0, ang: 0, crouchToggle: false, crouched: false, hasLoot: false, hidden: false, vent: null, choke: null, speed: 0, stepDist: 0, knockCd: 0 };
    this.rebuildAgent();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    this.resize();
    this.loadRoom(3 + Math.floor(Math.random() * 3), true);
    this.enterTitle(true);

    this._last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      this.frame(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ setup

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.75 : 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.comic.setSize(Math.round(w * pr), Math.round(h * pr));
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 50 : 42;
    this.camera.updateProjectionMatrix();
    this.camRig.portrait = w < h * 0.9;
    this.layoutPreview();
  }

  buildPreview() {
    // A noir turntable: one hard key, a crimson kicker, a blood-red backdrop slab.
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x050506);
    s.fog = new THREE.Fog(0x050506, 9, 20);
    s.add(new THREE.HemisphereLight(0x8090c0, 0x100808, 0.55));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
    key.position.set(2.5, 4, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: 1, far: 12 });
    const rim = new THREE.DirectionalLight(0xc1121f, 2.4);
    rim.position.set(-3, 2.5, -3.5);
    s.add(key, rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.12, 8), toon(0x16161a));
    disc.position.y = -0.06;
    disc.receiveShadow = true;
    inkEdges(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.025, 4, 8), new THREE.MeshBasicMaterial({ color: 0xc1121f }));
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = Math.PI / 8;
    ring.position.y = 0.01;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 24), toon(0x0c0c0e));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.12;
    floor.receiveShadow = true;
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(5, 9), new THREE.MeshBasicMaterial({ color: 0x8a0d18, fog: false }));
    slab.position.set(0.4, 2.2, -4.5);
    slab.rotation.z = -0.22;
    const slab2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 9), new THREE.MeshBasicMaterial({ color: 0xefe6d2, fog: false }));
    slab2.position.set(-2.6, 2.2, -4.4);
    slab2.rotation.z = -0.22;
    s.add(disc, ring, floor, slab, slab2);
    this.previewScene = s;
    this.previewCam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    this.previewSpin = 0.5;
  }

  layoutPreview() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cam = this.previewCam;
    cam.aspect = w / h;
    const portrait = w < h;
    cam.position.set(0, 1.3, portrait ? 8.4 : 4.3);
    cam.lookAt(0, 0.95, 0);
    // Shift the picture so the agent sits in the space the panel leaves free.
    if (portrait) cam.setViewOffset(w, h, 0, h * 0.29, w, h);
    else cam.setViewOffset(w, h, Math.min(390, w * 0.46) / 2, 0, w, h);
    cam.updateProjectionMatrix();
  }

  rebuildAgent() {
    const spec = agentSpec(this.save.agent);
    if (this.playerRig) this.playerRig.root.removeFromParent();
    this.playerRig = buildCharacter(spec);
    addSilhouette(this.playerRig);
    this.scene.add(this.playerRig.root);
    this.playerRig.root.visible = this.state !== 'title';
    if (this.previewRig) this.previewRig.root.removeFromParent();
    this.previewRig = buildCharacter(spec);
    this.previewScene.add(this.previewRig.root);
  }

  themeFor(roomNo) {
    const fixed = this.setup.theme;
    if (fixed && fixed !== 'random' && THEMES[fixed]) return fixed;
    let id = new RNG(`${this.run.seed}#${roomNo}:theme`).pick(THEME_IDS);
    if (id === this.lastTheme) id = THEME_IDS[(THEME_IDS.indexOf(id) + 1) % THEME_IDS.length];
    return id;
  }

  loadRoom(roomNo, attract = false) {
    // tear down the old room
    for (const g of this.guards) {
      g.rig.root.removeFromParent();
      g.cone.dispose();
      g.icon.dispose();
    }
    this.guards = [];
    if (this.fx) this.fx.dispose();
    if (this.world) {
      this.world.group.removeFromParent();
      this.world.dispose();
    }

    const theme = this.themeFor(roomNo);
    const level = attract ? roomNo : tierFor(roomNo, this.setup) + this.levelOffset;
    const room = generateRoom({ seed: `${this.run.seed}#${roomNo}`, level, theme, mods: attract ? null : this.mods });
    this.lastTheme = theme;
    this.room = room;
    this.attract = attract;
    this.world = buildWorld(room, { lowPower: this.lowPower });
    this.scene.add(this.world.group);
    const art = this.world.art;
    this.scene.fog = new THREE.FogExp2(art.fog[0], art.fog[1]);
    this.scene.background = new THREE.Color(art.fog[0]);
    this.renderer.toneMappingExposure = art.exposure;
    if (this.bloom) this.bloom.strength = art.bloom;
    this.comic.setGrade(art.grade[0], art.grade[1]);
    this.fx = createFx(this.scene);
    this.radar.setRoom(room);

    this.guards = room.guards.map((def) => {
      const rig = buildCharacter(guardSpec(room.themeId, new RNG(def.look)));
      this.scene.add(rig.root);
      return { def, rig, cone: createCone(this.scene), icon: this.fx.headIcon(), pose: { x: 0, z: 0, ang: 0 }, tmp: {} };
    });
    this.resetRoom();
  }

  /** Put everything in the room back to its starting state (instant retry). */
  resetRoom() {
    const room = this.room;
    const p = this.player;
    Object.assign(p, {
      x: room.start.x,
      z: room.start.z,
      ang: room.start.ang,
      crouchToggle: false,
      crouched: false,
      hasLoot: false,
      hidden: false,
      vent: null,
      choke: null,
      speed: 0,
      stepDist: 0,
      knockCd: 0,
    });
    this.lasers = room.lasers.map(() => true);
    this.stats = { time: 0, knockouts: 0, closeCalls: 0 };
    this.failT = 0;
    this.clearT = 0;
    this.ctx = null;
    for (const g of this.guards) {
      Object.assign(g, { state: 'patrol', clock: 0, meter: 0, peak: 0, timer: 0, path: null, pi: 0, blend: 0, wake: null, found: false, speed: 0, zT: 0, lastSeen: null });
      poseAt(g.def.timeline, 0, g.pose);
      g.rig.root.position.set(g.pose.x, 0, g.pose.z);
      g.rig.root.rotation.y = yawOf(g.pose.ang);
      settleCharacter(g.rig, { mode: 'normal', speed: 0 });
      g.cone.setVisible(true);
    }
    room.lasers.forEach((_, i) => this.world.setLaser(i, true));
    this.world.setLootTaken(false);
    this.world.setExitActive(false);
    this.playerRig.root.visible = !this.attract;
    this.playerRig.root.position.set(p.x, 0, p.z);
    this.playerRig.root.rotation.y = yawOf(p.ang);
    settleCharacter(this.playerRig, { mode: 'normal', speed: 0 });
    this.camRig.yaw = Math.atan2(-Math.cos(room.start.ang), -Math.sin(room.start.ang));
    this.camRig.snap(p.x, p.z);
    this.ui.setCrouch(false);
    this.updateObjective();
  }

  updateObjective() {
    const room = this.room;
    const loot = room.loot.info;
    const theme = THEMES[room.themeId];
    const tag = this.runLabel();
    if (!this.player.hasLoot) this.ui.setObjective({ tag, text: `Steal: ${loot.name}`, sub: `${theme.name} · ${room.venue}` });
    else this.ui.setObjective({ tag, text: 'Reach the extraction pad', sub: `Carrying: ${loot.name}`, done: true });
  }

  // ------------------------------------------------------------ flow

  enterTitle(first = false) {
    if (!first && !this.attract) {
      this.run.seed = this.fixedSeed || randomSeedString();
      this.attract = true;
      this.resetRoom();
    }
    this.state = 'title';
    this.audio.stopMusic();
    this.playerRig.root.visible = false;
    this.ui.setHud(false);
    this.ui.hideBanner();
    this.ui.setTitle({ agent: this.save.agent, seed: this.run.seed, setupLine: describeSetup(this.setup) });
    this.ui.show('title');
  }

  /** "SECTOR 07 · LARGE COMPOUND · OPERATIVE · CLASSIC RAMP" for the current room. */
  runLabel() {
    return describeRun(this.run.roomNo, this.setup);
  }

  /** Called on every change in the Mission Setup panel. */
  applySetup(setup) {
    this.setup = normalizeSetup(setup);
    this.mods = resolveMods(this.setup);
    this.save.settings.setup = { ...this.setup };
    storeSave(this.save);
    this.ui.setSetupLine(describeSetup(this.setup), describeRun(this.returnTo === 'paused' ? this.run.roomNo : 1, this.setup));
    // keep the address bar shareable
    const params = setupToParams(this.setup, new URLSearchParams(location.search));
    const q = params.toString();
    history.replaceState(null, '', q ? `?${q}` : location.pathname);
  }

  openSetup() {
    this.returnTo = this.state === 'paused' ? 'paused' : 'title';
    this.themeBefore = this.setup.theme;
    this.state = 'setup';
    this.setupPanel.open(this.setup, this.returnTo === 'paused');
    this.ui.setSetupLine(describeSetup(this.setup), describeRun(this.returnTo === 'paused' ? this.run.roomNo : 1, this.setup));
    this.ui.setHud(false);
    this.ui.show('setup');
  }

  startRun() {
    this.audio.unlock();
    this.audio.uiBig();
    this.run.roomNo = 1;
    this.run.streak = 0;
    this.lastTheme = null;
    this.beginRoom();
  }

  async beginRoom() {
    if (this.loadingRoom) return;
    this.loadingRoom = true;
    this.state = 'loading';
    // Big compounds take a moment to generate and verify: say so first.
    await this.ui.loading(this.runLabel());
    this.loadRoom(this.run.roomNo, false);
    this.ui.loaded();
    this.loadingRoom = false;
    this.state = 'playing';
    this.ui.show(null);
    this.ui.setHud(true);
    this.audio.startMusic();
    const room = this.room;
    const loot = room.loot.info;
    const tip = TIPS[this.run.roomNo - 1];
    this.ui.banner(this.runLabel(), loot.name, (this.run.roomNo <= TIPS.length && this.setup.start === 'compact' ? tip : null) || `${room.venue} · ${loot.tagline}`, tip ? 5 : 3.6);
  }

  nextRoom() {
    if (this.state !== 'clear') return;
    this.run.roomNo++;
    this.beginRoom();
  }

  retry() {
    if (this.state !== 'failed' && this.state !== 'playing' && this.state !== 'paused') return;
    this.resetRoom();
    this.state = 'playing';
    this.ui.show(null);
    this.ui.setHud(true);
    this.audio.startMusic();
    this.ui.toast('ONE MORE TIME. QUIETLY.', 1.4);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.audio.stopMusic();
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.audio.startMusic();
    this.ui.show(null);
  }

  openCustomizer() {
    this.returnTo = this.state === 'paused' ? 'paused' : 'title';
    this.state = 'custom';
    this.customizer.open(this.save.agent);
    this.ui.setHud(false);
    this.ui.show('custom');
  }

  openVault() {
    this.returnTo = 'title';
    this.state = 'vault';
    this.ui.showVault(this.save);
  }

  back() {
    if (this.state !== 'custom' && this.state !== 'vault' && this.state !== 'setup') return;
    const themeChanged = this.state === 'setup' && this.themeBefore !== this.setup.theme;
    if (this.returnTo === 'paused') {
      this.state = 'paused';
      this.ui.setHud(true);
      this.ui.show('pause');
    } else {
      this.state = 'title';
      this.ui.setTitle({ agent: this.save.agent, seed: this.run.seed, setupLine: describeSetup(this.setup) });
      this.ui.show('title');
      if (themeChanged) {
        // show the chosen setting behind the menu
        this.lastTheme = null;
        this.loadRoom(3 + Math.floor(Math.random() * 3), true);
        this.playerRig.root.visible = false;
      }
    }
  }

  toggleMute() {
    this.audio.unlock();
    const m = !this.audio.muted;
    this.audio.setMuted(m);
    this.save.settings.mute = m;
    storeSave(this.save);
    this.ui.setMute(m);
    if (this.state === 'playing') this.ui.toast(m ? 'SOUND OFF' : 'SOUND ON', 1);
  }

  toggleStyle() {
    const s = this.save.settings;
    s.style = s.style === 'ps1' ? 'crisp' : 'ps1';
    storeSave(this.save);
    this.comic.setStyle(s.style);
    this.ui.setStyle(VISUAL_STYLES[s.style].name);
  }

  toggleCam() {
    const mode = this.camRig.toggle();
    this.save.settings.cam = mode;
    storeSave(this.save);
    this.ui.toast(mode === 'chase' ? 'CAMERA: CHASE' : 'CAMERA: OVERHEAD TACTICAL', 1.3);
  }

  fail(reason, guard) {
    if (this.state !== 'playing') return;
    this.state = 'failed';
    this.failT = 0;
    this.failReason = reason;
    this.failGuard = guard || null;
    this.run.streak = 0;
    if (guard) {
      guard.state = 'alert';
      guard.meter = 1;
    }
    this.audio.stopMusic();
    this.audio.alert();
    this.audio.fail();
    this.ui.flash();
    this.ui.setAction(null);
    this.fx.setPrompt(null);
    this.camRig.shake = 0.5;
    if (navigator.vibrate) navigator.vibrate([40, 30, 120]);
  }

  clear() {
    this.state = 'clear';
    this.clearT = 0;
    const s = this.stats;
    const res = rankFor({ time: s.time, par: this.room.par, knockouts: s.knockouts, closeCalls: s.closeCalls });
    const loot = this.room.loot.info;
    const isNew = recordLoot(this.save, loot, res.rank, { venue: this.room.venue, sector: this.run.roomNo, theme: this.room.themeId });
    this.run.streak++;
    const st = this.save.stats;
    st.rooms++;
    if (res.ghost) st.ghosts++;
    st.knockouts += s.knockouts;
    st.bestStreak = Math.max(st.bestStreak, this.run.streak);
    storeSave(this.save);
    this.result = { ...res, time: s.time, par: this.room.par, knockouts: s.knockouts, closeCalls: s.closeCalls, loot, venue: this.room.venue, isNew, streak: this.run.streak, meta: this.runLabel() };
    this.audio.stopMusic();
    this.audio.fanfare();
    this.fx.burst(this.player.x, 1.2, this.player.z, 0x5aff9a, 26);
    this.fx.burst(this.player.x, 1.4, this.player.z, 0xffd27a, 18);
    this.ui.setAction(null);
    this.fx.setPrompt(null);
  }

  // ------------------------------------------------------------ frame

  frame(dt) {
    const input = this.input;
    input.poll(dt);
    if (input.isTouch) this.ui.setTouch(true);
    this.time += dt;
    const t = this.time;

    if (input.take('mute')) this.toggleMute();
    switch (this.state) {
      case 'title':
        if (input.take('confirm')) this.startRun();
        break;
      case 'playing':
        if (input.take('pause')) this.pause();
        else if (input.take('retry')) this.retry();
        else if (input.take('cam')) this.toggleCam();
        break;
      case 'paused':
        if (input.take('pause')) this.resume();
        break;
      case 'failed':
        if (this.failT > 0.35 && (input.take('retry') || input.take('action') || input.take('confirm'))) this.retry();
        break;
      case 'clear':
        if (this.clearT > 1.2 && (input.take('confirm') || input.take('action'))) this.nextRoom();
        break;
      case 'custom':
      case 'setup':
      case 'vault':
        if (input.take('pause')) this.back();
        break;
    }

    const simulating = this.state === 'playing';
    const idle = this.state === 'title' || this.state === 'clear';
    if (simulating) {
      this.stats.time += dt;
      this.updatePlayer(dt);
    }
    if (this.state === 'playing' || idle) this.updateGuards(dt, this.state === 'playing');
    if (this.state === 'failed') {
      this.failT += dt;
      if (this.failT > 0.85 && this.failT - dt <= 0.85) this.ui.showFail(this.failReason);
      const g = this.failGuard;
      if (g) {
        g.pose.ang = approachAngle(g.pose.ang, Math.atan2(this.player.z - g.pose.z, this.player.x - g.pose.x), 9 * dt);
        g.rig.root.rotation.y = yawOf(g.pose.ang);
        animateCharacter(g.rig, { mode: 'alert', t }, dt);
        g.icon.set('!', g.pose.x, g.rig.height + 0.45, g.pose.z, 1, dt);
        g.cone.update(this.room, g.pose, g.def.vis, 1, true, t);
      }
      animateCharacter(this.playerRig, { mode: 'alert', crouch: false, t }, dt);
    }
    if (this.state === 'clear') {
      this.clearT += dt;
      if (this.clearT > 0.9 && this.clearT - dt <= 0.9) this.ui.showClear(this.result);
      animateCharacter(this.playerRig, { mode: 'alert', t }, dt);
      this.playerRig.root.rotation.y += dt * 2.5;
    }

    // ---- camera
    const o = input.orbit;
    if (this.state === 'custom') {
      this.previewSpin += dt * 0.5 + o.dx * 1.4;
      this.previewRig.root.rotation.y = this.previewSpin;
      animateCharacter(this.previewRig, { mode: 'normal', speed: 0, crouch: Math.sin(t * 0.6) > 0.82, t }, dt);
    } else if (this.state === 'title' || this.state === 'vault' || (this.state === 'setup' && this.attract)) {
      this.camRig.yaw += dt * 0.07;
      this.camRig.update(dt, this.room.w / 2, this.room.h / 2, { stiffness: 2, distScale: Math.max(this.room.w, this.room.h * 1.5) / 15 });
    } else if (this.state === 'failed' && this.failGuard) {
      const g = this.failGuard;
      this.camRig.update(dt, (g.pose.x + this.player.x) / 2, (g.pose.z + this.player.z) / 2, { stiffness: 12, distScale: 0.62 });
    } else {
      if (this.state === 'playing') this.camRig.orbit(o.dx, o.dy, o.zoom);
      if (this.state === 'clear') this.camRig.yaw += dt * 0.25;
      this.camRig.update(dt, this.player.x, this.player.z, { distScale: this.state === 'clear' ? 0.7 : 1 });
    }

    if (this.state !== 'paused' && this.state !== 'custom' && !(this.state === 'setup' && !this.attract)) {
      this.world.update(t, dt, this.camera.position);
      this.fx.update(dt);
    }
    if (this.state === 'playing' || this.state === 'failed') this.drawHud(t);

    const preview = this.state === 'custom';
    this.renderPass.scene = preview ? this.previewScene : this.scene;
    this.renderPass.camera = preview ? this.previewCam : this.camera;
    this.agentLight.position.set(this.player.x, 2.3, this.player.z);
    this.agentLight.visible = this.playerRig.root.visible;
    this.comic.setTime(t);
    this.composer.render(dt);
    input.endFrame();
  }

  drawHud(t) {
    const p = this.player;
    this.ui.setStats(this.stats.time, this.stats.knockouts);
    this.ui.setKnockReady(p.knockCd <= 0);
    this.radar.draw(
      {
        player: p.hidden ? null : { x: p.x, z: p.z, ang: p.ang },
        hasLoot: p.hasLoot,
        lasers: this.lasers,
        guards: this.guards.map((g) => ({
          x: g.pose.x,
          z: g.pose.z,
          ang: g.pose.ang,
          range: g.def.vis.range,
          half: g.def.vis.half,
          meter: g.meter,
          asleep: g.state === 'asleep' || g.state === 'held',
          alert: g.state === 'alert',
          wary: g.state !== 'patrol',
        })),
      },
      t,
    );
  }

  // ------------------------------------------------------------ player

  blocked(cx, cy) {
    return cellAt(this.room, cx, cy) !== FLOOR;
  }

  /** Slide a circle through the grid. */
  moveCircle(p, dx, dz) {
    const resolve = () => {
      const cx = Math.floor(p.x);
      const cy = Math.floor(p.z);
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let x = cx - 1; x <= cx + 1; x++) {
          if (!this.blocked(x, y)) continue;
          const nx = Math.max(x, Math.min(p.x, x + 1));
          const nz = Math.max(y, Math.min(p.z, y + 1));
          const ex = p.x - nx;
          const ez = p.z - nz;
          const d = Math.hypot(ex, ez);
          if (d >= PLAYER_R) continue;
          if (d > 1e-6) {
            p.x = nx + (ex / d) * PLAYER_R;
            p.z = nz + (ez / d) * PLAYER_R;
          } else {
            // centre is inside the cell: push back out the way we came
            p.x -= dx;
            p.z -= dz;
          }
        }
    };
    p.x += dx;
    resolve();
    p.z += dz;
    resolve();
  }

  updatePlayer(dt) {
    const p = this.player;
    const room = this.room;
    const input = this.input;
    const rig = this.playerRig;
    const t = this.time;
    p.knockCd = Math.max(0, p.knockCd - dt);

    // ---- crawling through a vent
    if (p.vent) {
      const v = p.vent;
      v.t += dt;
      const k = Math.min(1, v.t / v.dur);
      p.x = v.from.x + (v.to.x - v.from.x) * k;
      p.z = v.from.z + (v.to.z - v.from.z) * k;
      v.clank -= dt;
      if (v.clank <= 0) {
        v.clank = 0.26;
        this.audio.ventStep();
      }
      if (k >= 1) {
        p.vent = null;
        p.hidden = false;
        p.crouchToggle = true;
        p.crouched = true;
        p.ang = Math.atan2(-v.to.dy, -v.to.dx);
        rig.root.visible = true;
        settleCharacter(rig, { mode: 'normal', crouch: true, speed: 0 });
            this.audio.ventOpen();
        this.fx.ring(p.x, p.z, 0x9fe8ff, 1.2, 0.5);
      }
      this.ui.setAction(null);
      this.fx.setPrompt(null);
      return;
    }

    // ---- mid sleeper hold
    if (p.choke) {
      const c = p.choke;
      c.t += dt;
      animateCharacter(rig, { mode: 'choking', t }, dt);
      if (c.t >= CHOKE_TIME) {
        c.g.state = 'asleep';
        c.g.meter = 0;
        c.g.zT = 0.4;
        c.g.cone.setVisible(false);
        this.stats.knockouts++;
        p.choke = null;
        this.ui.toast('SWEET DREAMS', 1.2);
        this.fx.stamp('ZZZ', '#efe6d2', c.g.pose.x, 2.0, c.g.pose.z, 0.6, 1.4);
      }
      this.ui.setAction(null);
      this.fx.setPrompt(null);
      return;
    }

    // ---- movement
    if (input.take('crouch')) p.crouchToggle = !p.crouchToggle;
    const crouched = p.crouchToggle !== input.shift;
    if (crouched !== p.crouched) {
      p.crouched = crouched;
      this.ui.setCrouch(crouched);
    }
    const b = this.camRig.basis();
    let wx = b.rx * input.move.x + b.fx * input.move.y;
    let wz = b.rz * input.move.x + b.fz * input.move.y;
    const mag = Math.min(1, Math.hypot(wx, wz));
    let speed = 0;
    if (mag > 0.01) {
      wx /= Math.hypot(wx, wz) || 1;
      wz = Math.sign(wz) * Math.sqrt(Math.max(0, 1 - wx * wx));
      if (crouched) speed = CROUCH_SPEED * Math.max(0.35, mag);
      else speed = mag < 0.55 ? TIPTOE_SPEED * Math.max(0.4, mag / 0.55) : TIPTOE_SPEED + ((mag - 0.55) / 0.45) * (RUN_SPEED - TIPTOE_SPEED);
      const ox = p.x;
      const oz = p.z;
      this.moveCircle(p, wx * speed * dt, wz * speed * dt);
      const moved = Math.hypot(p.x - ox, p.z - oz);
      speed = Math.min(speed, moved / Math.max(dt, 1e-4));
      p.ang = approachAngle(p.ang, Math.atan2(wz, wx), 13 * dt);
      p.stepDist += moved;
      const stride = crouched ? 0.6 : speed > 3 ? 0.95 : 0.7;
      if (p.stepDist > stride) {
        p.stepDist = 0;
        const loud = !crouched && speed > 3;
        this.audio.step(crouched, loud);
        if (loud) this.footstepNoise();
      }
    }
    p.speed = speed;
    rig.root.position.set(p.x, 0, p.z);
    rig.root.rotation.y = yawOf(p.ang);
    animateCharacter(rig, { mode: 'normal', crouch: crouched, speed, t }, dt);

    // ---- lasers
    for (let i = 0; i < room.lasers.length; i++) {
      if (!this.lasers[i]) continue;
      const l = room.lasers[i];
      const d = l.vertical ? Math.abs(p.x - l.x0) : Math.abs(p.z - l.z0);
      const along = l.vertical ? p.z : p.x;
      const lo = l.vertical ? l.z0 : l.x0;
      const hi = l.vertical ? l.z1 : l.x1;
      if (d < PLAYER_R + 0.03 && along > lo - 0.1 && along < hi + 0.1) {
        this.fail('You walked into a laser. The laser noticed.', null);
        return;
      }
    }

    // ---- extraction
    if (p.hasLoot && Math.hypot(p.x - room.exit.x, p.z - room.exit.z) < 0.62) {
      this.clear();
      return;
    }

    // ---- knock
    if (input.take('knock')) {
      if (p.knockCd <= 0) this.knock();
    }

    // ---- context action
    const ctx = this.findContext();
    this.ctx = ctx;
    this.ui.setAction(ctx);
    this.fx.setPrompt(ctx ? ctx.ring : null, ctx ? ctx.color : 0, t);
    if (ctx && input.take('action')) this.doAction(ctx);
  }

  findContext() {
    const p = this.player;
    const room = this.room;
    let best = null;
    let bestD = Infinity;
    for (const g of this.guards) {
      if (!AWAKE.has(g.state) || !canChoke(g.pose, p.x, p.z)) continue;
      if (!hasLineOfSight(room, p.x, p.z, g.pose.x, g.pose.z, false)) continue;
      const d = Math.hypot(g.pose.x - p.x, g.pose.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (best) return { type: 'choke', label: 'CHOKE', text: 'SLEEPER HOLD', guard: best, ring: { x: best.pose.x, z: best.pose.z, r: 0.62 }, color: 0xffb347 };
    if (!p.hasLoot && Math.hypot(p.x - room.loot.x, p.z - room.loot.z) < 1.45)
      return { type: 'grab', label: 'GRAB', text: 'GRAB THE LOOT', ring: { x: room.loot.x, z: room.loot.z, r: 0.75 }, color: 0xffd27a };
    for (const s of room.switches) {
      if (!this.lasers[s.laser]) continue;
      if (Math.hypot(p.x - (s.cx + 0.5 + s.dx * 0.3), p.z - (s.cy + 0.5 + s.dy * 0.3)) < 1.05)
        return { type: 'switch', label: 'SWITCH', text: 'KILL THE LASERS', sw: s, ring: { x: s.cx + 0.5, z: s.cy + 0.5, r: 0.55 }, color: 0xff5a4a };
    }
    for (let i = 0; i < room.vents.length; i++) {
      const v = room.vents[i];
      for (const [from, to, reverse] of [
        [v.a, v.b, false],
        [v.b, v.a, true],
      ]) {
        if (Math.hypot(p.x - (from.cx + 0.5), p.z - (from.cy + 0.5)) < 0.85)
          return { type: 'vent', label: 'VENT', text: 'CRAWL THE VENT', i, from, to, reverse, time: v.time, ring: { x: from.cx + 0.5, z: from.cy + 0.5, r: 0.6 }, color: 0x54e8ff };
      }
    }
    return null;
  }

  doAction(ctx) {
    const p = this.player;
    if (ctx.type === 'choke') {
      const g = ctx.guard;
      g.state = 'held';
      g.path = null;
      // tuck in right behind them
      p.x = g.pose.x - Math.cos(g.pose.ang) * 0.42;
      p.z = g.pose.z - Math.sin(g.pose.ang) * 0.42;
      p.ang = g.pose.ang;
      p.choke = { g, t: 0 };
      p.speed = 0;
      this.playerRig.root.position.set(p.x, 0, p.z);
      this.playerRig.root.rotation.y = yawOf(p.ang);
      this.audio.choke();
    } else if (ctx.type === 'grab') {
      p.hasLoot = true;
      this.world.setLootTaken(true);
      this.world.setExitActive(true);
      this.audio.chime();
      this.fx.burst(this.room.loot.x, 1.3, this.room.loot.z, 0xffd27a, 22);
      this.fx.stamp('YOINK!', '#ffd27a', this.room.loot.x, 2.1, this.room.loot.z, 0.6, 1.3, '#c1121f');
      this.fx.ring(this.room.exit.x, this.room.exit.z, 0x5aff9a, 3, 1.4);
      this.updateObjective();
      this.ui.banner(`${this.room.loot.info.rarity} · ${this.room.loot.info.serial}`, this.room.loot.info.name, 'Extraction pad is live. Get out clean.', 2.6);
    } else if (ctx.type === 'switch') {
      const i = ctx.sw.laser;
      this.lasers[i] = false;
      this.world.setLaser(i, false);
      this.audio.switchFlip();
      this.fx.ring(ctx.ring.x, ctx.ring.z, 0x33ff88, 2, 0.7);
      this.ui.toast('LASERS OFFLINE', 1.6);
    } else if (ctx.type === 'vent') {
      p.vent = {
        i: ctx.i,
        reverse: ctx.reverse,
        from: { x: ctx.from.cx + 0.5, z: ctx.from.cy + 0.5 },
        to: { x: ctx.to.cx + 0.5, z: ctx.to.cy + 0.5, dx: ctx.to.dx, dy: ctx.to.dy },
        t: 0,
        dur: ctx.time,
        clank: 0.1,
      };
      p.hidden = true;
      p.speed = 0;
      this.playerRig.root.visible = false;
      this.audio.ventOpen();
    }
  }

  knock() {
    const p = this.player;
    p.knockCd = KNOCK_COOLDOWN;
    this.audio.knock();
    this.fx.ring(p.x, p.z, 0xffc266, KNOCK_RADIUS, 1.0);
    this.fx.ring(p.x, p.z, 0xffc266, KNOCK_RADIUS * 0.6, 0.8);
    this.fx.stamp('KNOCK!', '#ffb000', p.x, 1.9, p.z, 0.62, 1.1);
    let heard = false;
    for (const g of this.guards) {
      if (!AWAKE.has(g.state)) continue;
      if (Math.hypot(g.pose.x - p.x, g.pose.z - p.z) > KNOCK_RADIUS) continue;
      this.investigate(g, p.x, p.z);
      heard = true;
    }
    if (heard) this.audio.suspicious();
  }

  footstepNoise() {
    const p = this.player;
    this.fx.ring(p.x, p.z, 0xffffff, FOOTSTEP_RADIUS, 0.45, 0.04);
    for (const g of this.guards) {
      if (g.state !== 'patrol' && g.state !== 'look' && g.state !== 'return') continue;
      if (Math.hypot(g.pose.x - p.x, g.pose.z - p.z) > FOOTSTEP_RADIUS) continue;
      if (!hasLineOfSight(this.room, g.pose.x, g.pose.z, p.x, p.z, false)) continue;
      g.state = 'suspicious';
      g.timer = 0;
      g.peak = Math.max(g.peak, 0.3);
      g.lastSeen = { x: p.x, z: p.z };
      this.stats.closeCalls++;
      this.audio.suspicious();
    }
  }

  // ------------------------------------------------------------ guards

  pathTo(g, x, z) {
    const from = nearestFloorCell(this.room, g.pose.x, g.pose.z);
    const to = nearestFloorCell(this.room, x, z);
    if (!from || !to) return null;
    const cells = findPath(this.room, from.cx, from.cy, to.cx, to.cy);
    if (!cells) return null;
    const pts = cells.map((c) => ({ x: c.cx + 0.5, z: c.cy + 0.5 }));
    if (pts.length > 1) pts.shift();
    return pts;
  }

  investigate(g, x, z, wake = null) {
    g.state = 'investigate';
    g.path = this.pathTo(g, x, z) || [];
    g.pi = 0;
    g.wake = wake;
    g.timer = 0;
  }

  startReturn(g) {
    const home = poseAt(g.def.timeline, g.clock, g.tmp);
    g.state = 'return';
    g.path = this.pathTo(g, home.x, home.z) || [];
    g.path.push({ x: home.x, z: home.z });
    g.pi = 0;
  }

  /** Walk along g.path; returns true on arrival. */
  followPath(g, dt, speed) {
    if (!g.path || g.pi >= g.path.length) return true;
    const pt = g.path[g.pi];
    const dx = pt.x - g.pose.x;
    const dz = pt.z - g.pose.z;
    const d = Math.hypot(dx, dz);
    const step = speed * dt;
    if (d <= step) {
      g.pose.x = pt.x;
      g.pose.z = pt.z;
      g.pi++;
    } else {
      g.pose.x += (dx / d) * step;
      g.pose.z += (dz / d) * step;
      g.pose.ang = approachAngle(g.pose.ang, Math.atan2(dz, dx), 6 * dt);
    }
    g.speed = speed;
    return g.pi >= g.path.length;
  }

  updateGuards(dt, live) {
    const room = this.room;
    const p = this.player;
    const t = this.time;
    let tension = 0;
    for (const g of this.guards) {
      const vis = g.def.vis;
      g.speed = 0;
      let mode = 'normal';

      if (g.state === 'asleep') {
        g.zT -= dt;
        if (g.zT <= 0) {
          g.zT = 1.1;
          this.fx.stamp('Z', '#efe6d2', g.pose.x - Math.cos(g.pose.ang) * 0.9, 0.6, g.pose.z - Math.sin(g.pose.ang) * 0.9, 0.34 + Math.random() * 0.25, 1.7);
          if (live && Math.hypot(p.x - g.pose.x, p.z - g.pose.z) < 7) this.audio.zzz();
        }
        animateCharacter(g.rig, { mode: 'sleep', t }, dt);
        g.icon.set(null);
        continue;
      }
      if (g.state === 'held') {
        animateCharacter(g.rig, { mode: 'held', t }, dt);
        g.icon.set(null);
        g.cone.setVisible(false);
        continue;
      }

      // ---- senses
      let sees = false;
      if (live && !p.hidden) {
        const dist = Math.hypot(p.x - g.pose.x, p.z - g.pose.z);
        if (isBumping(room, g.pose, p.x, p.z)) {
          sees = true;
          g.meter += 7 * dt;
        } else if (canSee(room, g.pose, p.x, p.z, p.crouched, vis)) {
          sees = true;
          g.meter += detectRate(dist, vis.range, p.crouched) * this.mods.detect * dt;
        }
        if (sees) {
          g.lastSeen = { x: p.x, z: p.z };
          g.peak = Math.max(g.peak, g.meter);
          if (g.meter >= 1) {
            this.fail(`${THEMES[room.themeId].guard} ${SPOTTED[Math.floor(Math.random() * SPOTTED.length)]}`, g);
            return;
          }
        }
      }
      if (!sees) g.meter = Math.max(0, g.meter - 0.45 * dt);

      // a guard who finds a napping colleague goes to wake them
      if (live && (g.state === 'patrol' || g.state === 'return')) {
        for (const s of this.guards) {
          if (s.state !== 'asleep' || s.found) continue;
          if (!canSee(room, g.pose, s.pose.x, s.pose.z, true, vis)) continue;
          s.found = true;
          this.investigate(g, s.pose.x, s.pose.z, s);
          this.audio.suspicious();
          break;
        }
      }

      // ---- behaviour
      switch (g.state) {
        case 'patrol': {
          g.clock += dt;
          const tp = poseAt(g.def.timeline, g.clock, g.tmp);
          g.pose.x = tp.x;
          g.pose.z = tp.z;
          if (g.blend > 0) {
            g.blend -= dt;
            g.pose.ang = approachAngle(g.pose.ang, tp.ang, 5 * dt);
          } else g.pose.ang = tp.ang;
          g.speed = tp.moving ? g.def.speed : 0;
          if (g.meter > 0.3) {
            g.state = 'suspicious';
            g.timer = 0;
            this.stats.closeCalls++;
            this.audio.suspicious();
          }
          break;
        }
        case 'suspicious': {
          mode = 'suspicious';
          if (g.lastSeen) g.pose.ang = approachAngle(g.pose.ang, Math.atan2(g.lastSeen.z - g.pose.z, g.lastSeen.x - g.pose.x), 3.2 * dt);
          g.timer = sees ? 0 : g.timer + dt;
          if (g.timer > 1.0) {
            if (g.peak >= 0.5 && g.lastSeen) this.investigate(g, g.lastSeen.x, g.lastSeen.z);
            else this.startReturn(g);
            g.peak = 0;
          }
          break;
        }
        case 'investigate': {
          if (this.followPath(g, dt, INVESTIGATE_SPEED)) {
            g.state = 'look';
            g.timer = g.wake ? 1.5 : 2.8;
            g.baseAng = g.pose.ang;
          }
          break;
        }
        case 'look': {
          mode = 'look';
          g.timer -= dt;
          g.pose.ang = g.baseAng + Math.sin((2.8 - g.timer) * 1.6) * 1.1;
          if (g.timer <= 0) {
            if (g.wake && g.wake.state === 'asleep') {
              const s = g.wake;
              s.found = false;
              s.cone.setVisible(true);
              this.startReturn(s);
              this.ui.toast('SOMEONE WOKE THEIR COLLEAGUE', 1.8);
            }
            g.wake = null;
            this.startReturn(g);
          }
          break;
        }
        case 'return': {
          if (this.followPath(g, dt, g.def.speed + 0.2)) {
            g.state = 'patrol';
            g.blend = 0.7;
          }
          break;
        }
      }

      g.rig.root.position.set(g.pose.x, 0, g.pose.z);
      g.rig.root.rotation.y = yawOf(g.pose.ang);
      animateCharacter(g.rig, { mode, speed: g.speed, t }, dt);
      g.cone.update(room, g.pose, vis, Math.min(1, g.meter), false, t);
      const wary = g.state === 'suspicious' || g.state === 'investigate' || g.state === 'look';
      if (wary || g.meter > 0.12) g.icon.set('?', g.pose.x, g.rig.height + 0.3, g.pose.z, wary ? Math.max(0.6, g.meter) : g.meter, dt);
      else g.icon.set(null);
      tension = Math.max(tension, g.meter, wary ? 0.45 : 0);
    }
    if (live) this.audio.setTension(tension);
  }
}
