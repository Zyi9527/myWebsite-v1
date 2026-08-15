// ballpit.js – 原生 Ballpit（忠实还原原组件物理和鼠标排斥效果）
(function () {
  const {
    Vector3, MeshStandardMaterial, InstancedMesh, SphereGeometry,
    AmbientLight, PointLight, Color, Object3D, SRGBColorSpace,
    WebGLRenderer, PerspectiveCamera, Scene,
    MathUtils, Raycaster, Plane, Vector2
  } = THREE;

  // ---------- 鼠标追踪 ----------
  const mouse = new Vector2();
  const tracked = new Map();
  let listenersAdded = false;

  function ensureListeners() {
    if (listenersAdded) return;
    document.body.addEventListener('pointermove', onPointerMove);
    document.body.addEventListener('pointerleave', onPointerLeave);
    listenersAdded = true;
  }

  function onPointerMove(e) {
    mouse.set(e.clientX, e.clientY);
    processInteraction();
  }

  function onPointerLeave() {
    for (const t of tracked.values()) {
      if (t.hover) {
        t.hover = false;
        t.onLeave(t);
      }
    }
  }

  function processInteraction() {
    for (const [el, t] of tracked) {
      const rect = el.getBoundingClientRect();
      if (isInside(rect)) {
        updatePosition(t, rect);
        if (!t.hover) {
          t.hover = true;
          t.onEnter(t);
        }
        t.onMove(t);
      } else if (t.hover) {
        t.hover = false;
        t.onLeave(t);
      }
    }
  }

  function isInside(rect) {
    return mouse.x >= rect.left && mouse.x <= rect.right && mouse.y >= rect.top && mouse.y <= rect.bottom;
  }

  function updatePosition(t, rect) {
    t.position.x = mouse.x - rect.left;
    t.position.y = mouse.y - rect.top;
    t.nPosition.x = (t.position.x / rect.width) * 2 - 1;
    t.nPosition.y = -(t.position.y / rect.height) * 2 + 1;
  }

  function track(el, cb) {
    const t = { position: new Vector2(), nPosition: new Vector2(), hover: false, ...cb };
    tracked.set(el, t);
    ensureListeners();
    return { dispose: () => tracked.delete(el) };
  }

  // ---------- 物理引擎（与原组件完全一致） ----------
  const _F = new Vector3(), _I = new Vector3(), _O = new Vector3(),
        _V = new Vector3(), _B = new Vector3(), _N = new Vector3(),
        _vec = new Vector3(), _j = new Vector3(), _H = new Vector3(), _T = new Vector3();

  class Physics {
    constructor(config) {
      this.config = config;
      this.count = config.count;
      this.p = new Float32Array(3 * config.count).fill(0);
      this.v = new Float32Array(3 * config.count).fill(0);
      this.s = new Float32Array(config.count).fill(1);
      this.center = new Vector3();
      this.init();
    }

    init() {
      const { config, p, s, center } = this;
      // 索引 0 留在原点
      center.toArray(p, 0);
      for (let i = 1; i < config.count; i++) {
        const idx = 3 * i;
        p[idx] = MathUtils.randFloatSpread(2 * config.maxX);
        p[idx + 1] = MathUtils.randFloatSpread(2 * config.maxY);
        p[idx + 2] = MathUtils.randFloatSpread(2 * config.maxZ);
      }
      s[0] = config.size0;
      for (let i = 1; i < config.count; i++) {
        s[i] = MathUtils.randFloat(config.minSize, config.maxSize);
      }
    }

    update(delta, controlSphere0) {
      const { config, p, v, s, center } = this;
      const startIdx = controlSphere0 ? 1 : 0;

      // 控制球（索引 0）移向鼠标位置
      if (controlSphere0) {
        _F.fromArray(p, 0);
        _F.lerp(center, 0.1).toArray(p, 0);
        _V.set(0, 0, 0).toArray(v, 0);
      }

      // 重力 + 摩擦力 + 速度
      for (let i = startIdx; i < config.count; i++) {
        const idx = 3 * i;
        _I.fromArray(p, idx);
        _B.fromArray(v, idx);
        _B.y -= delta * config.gravity * s[i];
        _B.multiplyScalar(config.friction);
        _B.clampLength(0, config.maxVelocity);
        _I.add(_B);
        _I.toArray(p, idx);
        _B.toArray(v, idx);
      }

      // 球间碰撞
      for (let i = startIdx; i < config.count; i++) {
        const idx = 3 * i;
        _I.fromArray(p, idx);
        _B.fromArray(v, idx);
        const r1 = s[i];

        for (let j = i + 1; j < config.count; j++) {
          const jdx = 3 * j;
          _O.fromArray(p, jdx);
          _N.fromArray(v, jdx);
          const r2 = s[j];
          _vec.copy(_O).sub(_I);
          const dist = _vec.length();
          const sumR = r1 + r2;
          if (dist < sumR && dist > 0.0001) {
            const overlap = sumR - dist;
            _j.copy(_vec).normalize().multiplyScalar(0.5 * overlap);
            _H.copy(_j).multiplyScalar(Math.max(_B.length(), 1));
            _T.copy(_j).multiplyScalar(Math.max(_N.length(), 1));
            _I.sub(_j);
            _B.sub(_H);
            _I.toArray(p, idx);
            _B.toArray(v, idx);
            _O.add(_j);
            _N.add(_T);
            _O.toArray(p, jdx);
            _N.toArray(v, jdx);
          }
        }

        // 与控制球碰撞（排斥）
        if (controlSphere0) {
          _F.fromArray(p, 0);
          _vec.copy(_F).sub(_I);
          const dist = _vec.length();
          const sumR0 = r1 + s[0];
          if (dist < sumR0 && dist > 0.0001) {
            const diff = sumR0 - dist;
            _j.copy(_vec).normalize().multiplyScalar(diff);
            _H.copy(_j).multiplyScalar(Math.max(_B.length(), 2));
            _I.sub(_j);
            _B.sub(_H);
            _I.toArray(p, idx);
            _B.toArray(v, idx);
          }
        }
      }

      // 墙壁反弹
      for (let i = startIdx; i < config.count; i++) {
        const idx = 3 * i;
        _I.fromArray(p, idx);
        _B.fromArray(v, idx);
        const r = s[i];
        if (Math.abs(_I.x) + r > config.maxX) {
          _I.x = Math.sign(_I.x) * (config.maxX - r);
          _B.x = -_B.x * config.wallBounce;
        }
        if (config.gravity === 0) {
          if (Math.abs(_I.y) + r > config.maxY) {
            _I.y = Math.sign(_I.y) * (config.maxY - r);
            _B.y = -_B.y * config.wallBounce;
          }
        } else {
          if (_I.y - r < -config.maxY) {
            _I.y = -config.maxY + r;
            _B.y = -_B.y * config.wallBounce;
          }
        }
        const maxZ = Math.max(config.maxZ, config.maxSize);
        if (Math.abs(_I.z) + r > maxZ) {
          _I.z = Math.sign(_I.z) * (config.maxZ - r);
          _B.z = -_B.z * config.wallBounce;
        }
        _I.toArray(p, idx);
        _B.toArray(v, idx);
      }
    }
  }

  // ---------- 球体系统 ----------
  class BallSystem extends InstancedMesh {
    constructor(renderer, config) {
      const mat = new MeshStandardMaterial({
        roughness: 0.5,
        metalness: 0.1,
        color: 0xffffff
      });
      super(new SphereGeometry(), mat, config.count);
      this.config = config;
      this.physics = new Physics(config);
      this.ambient = new AmbientLight(config.ambientColor || 0xffffff, config.ambientIntensity || 1);
      this.add(this.ambient);
      this.light = new PointLight(config.colors?.[0] || 0xffffff, config.lightIntensity || 200);
      this.add(this.light);
      this.setColors(config.colors || [0xffffff]);
    }

    setColors(colors) {
      if (colors.length > 1) {
        const colorList = colors.map(c => new Color(c));
        for (let i = 0; i < this.count; i++) {
          this.setColorAt(i, colorList[MathUtils.randInt(0, colorList.length - 1)]);
        }
      } else {
        const col = new Color(colors[0] || 0xffffff);
        for (let i = 0; i < this.count; i++) this.setColorAt(i, col);
      }
      this.instanceColor.needsUpdate = true;
    }

    update(delta, controlSphere0) {
      this.physics.update(delta, controlSphere0);
      const dummy = new Object3D();
      for (let i = 0; i < this.count; i++) {
        dummy.position.fromArray(this.physics.p, i * 3);
        // 若 controlSphere0 为 true 且索引 0，正常显示；若 followCursor 关闭，索引 0 的球隐藏
        if (i === 0 && !controlSphere0) {
          dummy.scale.setScalar(0);
        } else {
          dummy.scale.setScalar(this.physics.s[i]);
        }
        dummy.updateMatrix();
        this.setMatrixAt(i, dummy.matrix);
        if (i === 0) this.light.position.copy(dummy.position);
      }
      this.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- 主引擎 ----------
  class Engine {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = SRGBColorSpace;
      this.camera = new PerspectiveCamera(45, 2, 0.1, 100);
      this.camera.position.set(0, 0, 20);
      this.camera.lookAt(0, 0, 0);
      this.scene = new Scene();
      this.size = { w: 0, h: 0, wWidth: 0, wHeight: 0 };
      this.running = false;
      this.animId = null;

      const observer = new IntersectionObserver(([entry]) => {
        entry.isIntersecting ? this.start() : this.stop();
      }, { threshold: 0 });
      observer.observe(canvas);

      window.addEventListener('resize', () => this.resize());
      this.resize();
    }

    resize() {
      const parent = this.canvas.parentElement;
      if (parent) {
        this.size.w = parent.offsetWidth;
        this.size.h = parent.offsetHeight;
      } else {
        this.size.w = window.innerWidth;
        this.size.h = window.innerHeight;
      }
      this.renderer.setSize(this.size.w, this.size.h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.camera.aspect = this.size.w / this.size.h;
      this.camera.updateProjectionMatrix();
      // 计算世界尺寸（用于碰撞边界）
      const vFov = (this.camera.fov * Math.PI) / 180;
      this.size.wHeight = 2 * Math.tan(vFov / 2) * this.camera.position.length();
      this.size.wWidth = this.size.wHeight * this.camera.aspect;
    }

    start() {
      if (this.running) return;
      this.running = true;
      let lastTime = performance.now();
      const loop = () => {
        this.animId = requestAnimationFrame(loop);
        const now = performance.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        this.onUpdate?.(delta);
        this.renderer.render(this.scene, this.camera);
      };
      loop();
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.animId);
    }

    dispose() {
      this.stop();
      this.renderer.dispose();
    }
  }

  // ---------- 全局入口 ----------
  window.createBallpit = function (canvas, options = {}) {
    const cfg = {
      count: 200,
      colors: [0xffffff, 0xcccccc, 0x999999],
      ambientColor: 0xffffff,
      ambientIntensity: 1,
      lightIntensity: 200,
      minSize: 0.5,
      maxSize: 1,
      size0: 1,
      gravity: 0.5,
      friction: 0.9975,
      wallBounce: 0.95,
      maxVelocity: 0.15,
      maxX: 5,
      maxY: 5,
      maxZ: 2,
      followCursor: true,
      ...options
    };

    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';

    const engine = new Engine(canvas);
    let system = new BallSystem(engine.renderer, cfg);
    engine.scene.add(system);

    // 鼠标跟随
    const raycaster = new Raycaster();
    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const mouseWorld = new Vector3();

    let controlSphere0 = false;

    const tracker = track(canvas, {
      onEnter() {
        if (cfg.followCursor) controlSphere0 = true;
      },
      onMove() {
        if (!cfg.followCursor) return;
        raycaster.setFromCamera(tracker.nPosition, engine.camera);
        engine.camera.getWorldDirection(plane.normal);
        raycaster.ray.intersectPlane(plane, mouseWorld);
        system.physics.center.copy(mouseWorld);
      },
      onLeave() {
        controlSphere0 = false;
        system.physics.center.set(0, 0, 0); // 鼠标球回到原点
      }
    });

    engine.onUpdate = (delta) => {
      system.update(delta, controlSphere0);
    };

    // 更新边界
    const updateBounds = () => {
      system.config.maxX = engine.size.wWidth / 2;
      system.config.maxY = engine.size.wHeight / 2;
    };
    updateBounds();
    const oldResize = engine.resize.bind(engine);
    engine.resize = () => {
      oldResize();
      updateBounds();
    };

    return {
      engine,
      system,
      dispose() {
        tracker.dispose();
        engine.dispose();
      }
    };
  };
})();