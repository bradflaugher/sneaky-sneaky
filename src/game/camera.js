// Orbit camera with two framings: a 3rd-person Chase view and a high MGS-style
// Overhead Tactical view. Movement input is always relative to this camera.

import * as THREE from 'three';

const MODES = {
  chase: { pitch: 0.98, dist: 11, minPitch: 0.5, maxPitch: 1.4 },
  tactical: { pitch: 1.36, dist: 17, minPitch: 1.05, maxPitch: 1.5 },
};

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase';
    this.yaw = 0.5;
    this.pitch = MODES.chase.pitch;
    this.dist = MODES.chase.dist;
    this.zoom = 1;
    this.target = new THREE.Vector3();
    this.cur = { yaw: this.yaw, pitch: this.pitch, dist: this.dist };
    this.shake = 0;
    this.portrait = false;
  }

  setMode(mode, snap = false) {
    this.mode = mode;
    this.pitch = MODES[mode].pitch;
    this.dist = MODES[mode].dist;
    this.zoom = 1;
    if (snap) Object.assign(this.cur, { yaw: this.yaw, pitch: this.pitch, dist: this.dist });
  }

  toggle() {
    this.setMode(this.mode === 'chase' ? 'tactical' : 'chase');
    return this.mode;
  }

  orbit(dx, dy, dz) {
    const m = MODES[this.mode];
    this.yaw -= dx;
    this.pitch = Math.min(m.maxPitch, Math.max(m.minPitch, this.pitch + dy));
    this.zoom = Math.min(1.7, Math.max(0.55, this.zoom + dz * 0.08));
  }

  /** Ground-plane basis for camera-relative movement. */
  basis() {
    const s = Math.sin(this.cur.yaw);
    const c = Math.cos(this.cur.yaw);
    return { fx: -s, fz: -c, rx: c, rz: -s };
  }

  snap(x, z) {
    this.target.set(x, 0.9, z);
    Object.assign(this.cur, { yaw: this.yaw, pitch: this.pitch, dist: this.dist * this.zoom });
  }

  update(dt, fx, fz, { stiffness = 6, distScale = 1 } = {}) {
    const a = 1 - Math.exp(-stiffness * dt);
    this.target.x += (fx - this.target.x) * a;
    this.target.z += (fz - this.target.z) * a;
    this.target.y = 0.9;
    const b = 1 - Math.exp(-9 * dt);
    const wantDist = this.dist * this.zoom * distScale * (this.portrait ? 1.32 : 1);
    this.cur.yaw += (this.yaw - this.cur.yaw) * b;
    this.cur.pitch += (this.pitch - this.cur.pitch) * b;
    this.cur.dist += (wantDist - this.cur.dist) * b;
    const cp = Math.cos(this.cur.pitch);
    const cam = this.camera;
    cam.position.set(
      this.target.x + Math.sin(this.cur.yaw) * cp * this.cur.dist,
      this.target.y + Math.sin(this.cur.pitch) * this.cur.dist,
      this.target.z + Math.cos(this.cur.yaw) * cp * this.cur.dist,
    );
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-7 * dt);
    }
    cam.lookAt(this.target);
  }
}
