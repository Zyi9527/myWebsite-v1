// circularGallery.js – 修复版：绝对无黑边，无缝循环
import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';

function lerp(p1, p2, t) { return p1 + (p2 - p1) * t; }

class MediaItem {
  constructor({ gl, geometry, image, index, length, scene, screen, viewport, bend, borderRadius }) {
    this.gl = gl; this.geometry = geometry; this.image = image; this.index = index;
    this.length = length; this.scene = scene; this.screen = screen; this.viewport = viewport;
    this.bend = bend; this.borderRadius = borderRadius;
    this.extra = 0;
    this.pixelWidth = 0;
    this.createMesh();
    this.onResize();
  }

  createMesh() {
    const texture = new Texture(this.gl, { generateMipmaps: true });
    this.program = new Program(this.gl, {
      depthTest: false, depthWrite: false,
      vertex: `
        attribute vec3 position; attribute vec2 uv;
        uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragment: `
        precision highp float;
        uniform vec2 uImageSizes; uniform vec2 uPlaneSizes;
        uniform sampler2D tMap; uniform float uBorderRadius;
        varying vec2 vUv;
        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b;
          return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
        }
        void main() {
          vec2 ratio = vec2(
            min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
            min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
          );
          vec2 uv = vec2(vUv.x * ratio.x + (1.0 - ratio.x) * 0.5, vUv.y * ratio.y + (1.0 - ratio.y) * 0.5);
          vec4 color = texture2D(tMap, uv);
          float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
          float alpha = 1.0 - smoothstep(-0.002, 0.002, d);
          gl_FragColor = vec4(color.rgb, alpha);
        }
      `,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [0, 0] },
        uBorderRadius: { value: this.borderRadius }
      },
      transparent: true
    });

    this.plane = new Mesh(this.gl, { geometry: this.geometry, program: this.program });
    this.plane.setParent(this.scene);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = this.image;
    img.onload = () => {
      texture.image = img;
      this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight];
      if (window.notifyImageLoaded) window.notifyImageLoaded();
    };
  }

  update(scroll, direction) {
    this.plane.position.x = this.x - scroll.current - this.extra;
    const x = this.plane.position.x;
    const H = this.viewport.width / 2;
    if (this.bend !== 0) {
      const B = Math.abs(this.bend);
      const R = (H * H + B * B) / (2 * B);
      const effX = Math.min(Math.abs(x), H);
      const arc = R - Math.sqrt(R * R - effX * effX);
      if (this.bend > 0) {
        this.plane.position.y = -arc;
        this.plane.rotation.z = -Math.sign(x) * Math.asin(effX / R);
      } else {
        this.plane.position.y = arc;
        this.plane.rotation.z = Math.sign(x) * Math.asin(effX / R);
      }
    }
    const planeOffset = this.plane.scale.x / 2;
    const viewportOffset = this.viewport.width / 2;
    this.isBefore = this.plane.position.x + planeOffset < -viewportOffset;
    this.isAfter = this.plane.position.x - planeOffset > viewportOffset;
    if (direction === 'right' && this.isBefore) { this.extra -= this.widthTotal; }
    if (direction === 'left' && this.isAfter) { this.extra += this.widthTotal; }
  }

  onResize({ screen, viewport } = {}) {
    if (screen) this.screen = screen;
    if (viewport) this.viewport = viewport;
    this.scale = this.screen.height / 1500;
    this.plane.scale.y = (this.viewport.height * (900 * this.scale)) / this.screen.height;
    this.plane.scale.x = (this.viewport.width * (700 * this.scale)) / this.screen.width;
    this.plane.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y];
    this.padding = 2;
    this.width = this.plane.scale.x + this.padding;
    this.pixelWidth = this.width * (this.screen.width / this.viewport.width);
    this.widthTotal = this.width * this.length;
    this.x = this.width * this.index;
  }
}

export class CircularGalleryApp {
  constructor(container, { items, bend = 3, borderRadius = 0.05 }) {
    this.container = container;
    this.scroll = { current: 0, target: 0, last: 0, ease: 0.05 };
    this.bend = bend;
    this.borderRadius = borderRadius;
    this.items = items;               // 原始图片数组
    this.originalCount = items.length; // 原始数量

    this.createRenderer();
    this.createCamera();
    this.createScene();
    this.onResize();
    this.createGeometry();
    this.createMedias();
    this.update();
    this.addEventListeners();
  }

  createRenderer() {
    this.renderer = new Renderer({ alpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 2) });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.container.appendChild(this.gl.canvas);
  }

  createCamera() {
    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  }

  createScene() { this.scene = new Transform(); }

  createGeometry() { this.geometry = new Plane(this.gl, { heightSegments: 50, widthSegments: 100 }); }

  createMedias() {
    // 为保证在任何视口宽度下都无黑边，复制 4 套完整的图片序列
    const multiplier = 4;
    const repeated = [];
    for (let i = 0; i < multiplier; i++) {
      repeated.push(...this.items);
    }
    this.medias = repeated.map((data, i) => new MediaItem({
      gl: this.gl,
      geometry: this.geometry,
      image: data.image,
      index: i,
      length: repeated.length,
      scene: this.scene,
      screen: this.screen,
      viewport: this.viewport,
      bend: this.bend,
      borderRadius: this.borderRadius
    }));
  }

  // 点击时返回原始索引（0 ～ originalCount-1）
  getItemIndexAtScreenX(screenX) {
    if (!this.medias || !this.medias.length) return -1;
    const scale = this.screen.width / this.viewport.width;
    const screenCenterX = this.screen.width / 2;
    for (let i = 0; i < this.medias.length; i++) {
      const m = this.medias[i];
      const pixelCenterX = m.plane.position.x * scale + screenCenterX;
      const cardPixelWidth = m.pixelWidth;
      if (!cardPixelWidth) continue;
      if (screenX >= pixelCenterX - cardPixelWidth/2 && screenX <= pixelCenterX + cardPixelWidth/2) {
        return i % this.originalCount;
      }
    }
    return -1;
  }

  onResize() {
    this.screen = { width: this.container.clientWidth, height: this.container.clientHeight };
    this.renderer.setSize(this.screen.width, this.screen.height);
    this.camera.perspective({ aspect: this.screen.width / this.screen.height });
    const fov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;
    this.viewport = { width, height };
    if (this.medias) this.medias.forEach(m => m.onResize({ screen: this.screen, viewport: this.viewport }));
  }

  update() {
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease);
    const direction = this.scroll.current > this.scroll.last ? 'right' : 'left';
    if (this.medias) this.medias.forEach(m => m.update(this.scroll, direction));
    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
    this.animId = requestAnimationFrame(() => this.update());
  }

  onTouchDown(e) { this.isDown = true; this.scrollPos = this.scroll.current; this.start = e.touches ? e.touches[0].clientX : e.clientX; }
  onTouchMove(e) {
    if (!this.isDown) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    this.scroll.target = this.scrollPos + (this.start - x) * 0.05;
  }
  onTouchUp() { this.isDown = false; }
  onWheel(e) { this.scroll.target += (e.deltaX > 0 ? 2 : -2) * 0.2; }

  addEventListeners() {
    this._onResize = () => this.onResize();
    this._onWheel = (e) => this.onWheel(e);
    this._onMouseDown = (e) => this.onTouchDown(e);
    this._onMouseMove = (e) => this.onTouchMove(e);
    this._onMouseUp = () => this.onTouchUp();

    window.addEventListener('resize', this._onResize);
    this.container.addEventListener('wheel', this._onWheel);
    this.container.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this.container.addEventListener('touchstart', this._onMouseDown);
    this.container.addEventListener('touchmove', this._onMouseMove);
    this.container.addEventListener('touchend', this._onMouseUp);
  }

  destroy() {
    cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this._onResize);
    this.container.removeEventListener('wheel', this._onWheel);
    this.container.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.container.removeEventListener('touchstart', this._onMouseDown);
    this.container.removeEventListener('touchmove', this._onMouseMove);
    this.container.removeEventListener('touchend', this._onMouseUp);
    if (this.gl && this.gl.canvas && this.gl.canvas.parentNode) {
      this.gl.canvas.parentNode.removeChild(this.gl.canvas);
    }
  }
}
