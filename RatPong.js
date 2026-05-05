import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

export class RatPong {
  constructor(container) {
    this.container = container;
    this.active = true;
    this.init();
  }

  init() {
    // --- Config ---
    this.FIELD_W = 26;
    this.FIELD_H = 16;
    this.PADDLE_W = 0.25;
    this.PADDLE_H = 2.4;
    this.BALL_R = 0.4;
    this.PADDLE_MARGIN = 1.2;
    this.RES_SCALE = 1.0; // Higher for expanded view

    // --- State ---
    this.autoplay = true; // Default to autoplay for catalog
    this.playerScore = 0;
    this.cpuScore = 0;
    this.gameActive = true;
    this.resetTimer = null;
    this.mouseY = 0;
    this.mouseActive = false;
    this.insanity = 0;
    this.targetInsanity = 0;
    this.ratScale = 1;
    this.playerY = 0;
    this.cpuY = 0;
    this.ballPos = new THREE.Vector3(0, 0, 0);
    this.ballVel = new THREE.Vector3(6, 3, 0);
    this.ballSpin = new THREE.Vector3(0, 0, 0);
    this.ballSpinVel = new THREE.Vector3(0, 0, 8);
    this.ratGroup = new THREE.Group();
    this.ratMesh = null;
    this.ratGhosts = [];

    // --- Scene ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.updateLayout();
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    this.scene.add(this.ratGroup);

    this.loadRatModel(0);
    this.resetGame();

    this.clock = new THREE.Clock();
    this.animate();

    this.setupEvents();
  }

  setupEvents() {
    this._onMouseMove = (e) => {
      this.mouseActive = true;
      const rect = this.container.getBoundingClientRect();
      this.mouseY = (1 - (e.clientY - rect.top) / rect.height) * this.FIELD_H - this.FIELD_H / 2;
    };
    this._onKeyDown = (e) => {
      if (e.key.toLowerCase() === "a") this.autoplay = !this.autoplay;
    };
    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("keydown", this._onKeyDown);
  }

  removeEvents() {
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("keydown", this._onKeyDown);
  }

  createPaddle() {
    const group = new THREE.Group();
    const shardCount = 8;
    for (let i = 0; i < shardCount; i++) {
      const shard = new THREE.Mesh(
        new THREE.BoxGeometry(this.PADDLE_W, this.PADDLE_H / shardCount - 0.05, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
      );
      shard.position.y = (i - (shardCount - 1) / 2) * (this.PADDLE_H / shardCount);
      shard.userData.origY = shard.position.y;
      group.add(shard);
    }
    return group;
  }

  updateLayout() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.FIELD_H = 16;
    this.FIELD_W = this.FIELD_H * aspect * 0.95;
    const viewH = this.FIELD_H + 2;
    const viewW = viewH * aspect;

    if (!this.camera) {
      this.camera = new THREE.OrthographicCamera(-viewW / 2, viewW / 2, viewH / 2, -viewH / 2, 0.1, 100);
      this.camera.position.z = 10;
    } else {
      this.camera.left = -viewW / 2;
      this.camera.right = viewW / 2;
      this.camera.top = viewH / 2;
      this.camera.bottom = -viewH / 2;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);

    if (!this.border) {
      const borderMat = new THREE.LineBasicMaterial({ color: 0x111111 });
      this.border = new THREE.LineSegments(new THREE.BufferGeometry(), borderMat);
      this.scene.add(this.border);
    }
    this.border.geometry.dispose();
    this.border.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(this.FIELD_W, this.FIELD_H, 0.1));

    if (!this.playerPaddle) {
      this.playerPaddle = this.createPaddle();
      this.scene.add(this.playerPaddle);
    }
    this.playerPaddle.position.x = this.FIELD_W / 2 - this.PADDLE_MARGIN;

    if (!this.cpuPaddle) {
      this.cpuPaddle = this.createPaddle();
      this.scene.add(this.cpuPaddle);
    }
    this.cpuPaddle.position.x = -this.FIELD_W / 2 + this.PADDLE_MARGIN;
  }

  loadRatModel(index) {
    const path = `model_${index}.obj`;
    new OBJLoader().load(path, (obj) => this.setupRat(obj), undefined, () => {
      if (index < 1) this.loadRatModel(index + 1);
      else this.createProceduralRat();
    });
  }

  setupRat(obj) {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.geometry.computeBoundingBox();
        child.geometry.center();
        const box = new THREE.Box3().setFromObject(child);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 1.2 / maxDim;
        child.geometry.scale(scale, scale, scale);
        child.material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true });
        new THREE.TextureLoader().load('rattex.png', (tex) => {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          child.material.map = tex;
          child.material.needsUpdate = true;
        });
      }
    });
    this.finalizeRat(obj);
  }

  createProceduralRat() {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.4), mat);
    group.add(body);
    this.finalizeRat(group);
  }

  finalizeRat(obj) {
    if (this.ratMesh) this.ratGroup.remove(this.ratMesh);
    this.ratGhosts.forEach(g => this.ratGroup.remove(g));
    this.ratGhosts = [];
    this.ratMesh = obj;
    this.ratGroup.add(this.ratMesh);
    const colors = [0xff4444, 0x44ff44, 0x4444ff];
    colors.forEach(c => {
      const ghost = this.ratMesh.clone();
      ghost.traverse(child => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.color.set(c);
          child.material.opacity = 0.5;
          child.material.blending = THREE.AdditiveBlending;
        }
      });
      this.ratGhosts.push(ghost);
      this.ratGroup.add(ghost);
    });
  }

  resetGame() {
    this.ballPos.set(0, 0, 0);
    const dir = Math.random() > 0.5 ? 1 : -1;
    const angle = (Math.random() - 0.5) * 0.8;
    this.ballVel.set(Math.cos(angle) * 7 * dir, Math.sin(angle) * 5, 0);
    this.ballSpin.set(0, 0, 0);
    this.ballSpinVel.set(Math.random() * 10 - 5, Math.random() * 10 - 5, 12 + Math.random() * 8);
    this.gameActive = true;
  }

  expSmooth(current, target, factor, dt) {
    return current + (target - current) * (1 - Math.exp(-factor * dt));
  }

  update(dt) {
    const t = Math.min(dt, 0.05);
    const maxY = this.FIELD_H / 2 - this.PADDLE_H / 2;

    let playerTarget = this.playerY;
    if (this.autoplay) playerTarget = this.gameActive ? this.ballPos.y : 0;
    else playerTarget = this.mouseY;

    this.playerY = this.expSmooth(this.playerY, THREE.MathUtils.clamp(playerTarget, -maxY, maxY), 15, t);

    let cpuTarget = this.cpuY;
    if (this.gameActive) cpuTarget = this.ballPos.y;
    else cpuTarget = 0;
    this.cpuY = this.expSmooth(this.cpuY, THREE.MathUtils.clamp(cpuTarget, -maxY, maxY), 8, t);

    this.playerPaddle.position.y = this.playerY;
    this.cpuPaddle.position.y = this.cpuY;

    if (this.gameActive) {
      this.ballPos.x += this.ballVel.x * t;
      this.ballPos.y += this.ballVel.y * t;

      const halfH = this.FIELD_H / 2 - this.BALL_R;
      if (this.ballPos.y > halfH) {
        this.ballPos.y = halfH;
        this.ballVel.y = -Math.abs(this.ballVel.y);
      } else if (this.ballPos.y < -halfH) {
        this.ballPos.y = -halfH;
        this.ballVel.y = Math.abs(this.ballVel.y);
      }

      const pX = this.FIELD_W / 2 - this.PADDLE_MARGIN;
      const cX = -this.FIELD_W / 2 + this.PADDLE_MARGIN;

      if (this.ballVel.x > 0 && this.ballPos.x > pX - this.PADDLE_W / 2 - this.BALL_R) {
        const hitY = this.ballPos.y - this.playerY;
        if (Math.abs(hitY) < this.PADDLE_H / 2 + this.BALL_R) {
          this.ballPos.x = pX - this.PADDLE_W / 2 - this.BALL_R;
          this.ballVel.x *= -1.05;
          this.ballVel.y += hitY * 3;
        }
      }
      if (this.ballVel.x < 0 && this.ballPos.x < cX + this.PADDLE_W / 2 + this.BALL_R) {
        const hitY = this.ballPos.y - this.cpuY;
        if (Math.abs(hitY) < this.PADDLE_H / 2 + this.BALL_R) {
          this.ballPos.x = cX + this.PADDLE_W / 2 + this.BALL_R;
          this.ballVel.x *= -1.05;
          this.ballVel.y += hitY * 3;
        }
      }

      if (this.ballPos.x > this.FIELD_W / 2 + 1 || this.ballPos.x < -this.FIELD_W / 2 - 1) {
        this.resetGame();
      }
    }

    this.ratGroup.position.set(this.ballPos.x, this.ballPos.y, 1);
    this.ballSpin.addScaledVector(this.ballSpinVel, t);
    this.ratGroup.rotation.set(this.ballSpin.x, this.ballSpin.y, this.ballSpin.z);
    this.ballSpinVel.multiplyScalar(1 - 0.5 * t);
  }

  animate() {
    if (!this.active) return;
    requestAnimationFrame(() => this.animate());
    this.update(this.clock.getDelta());
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    this.updateLayout();
  }

  destroy() {
    this.active = false;
    this.removeEvents();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
