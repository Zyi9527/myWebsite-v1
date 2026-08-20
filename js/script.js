// ==================== ScrollVelocity 加载器 ====================
function initScrollLoader() {
  const container = document.getElementById('echoLoader');
  if (!container) return;
  container.innerHTML = '';

  const text = 'LOADING';
  const numCopies = 8;
  const rows = 2;

  for (let r = 0; r < rows; r++) {
    const parallax = document.createElement('div');
    parallax.className = 'parallax';
    const scroller = document.createElement('div');
    scroller.className = 'scroller';

    const fragment = document.createDocumentFragment();
    for (let copy = 0; copy < 2; copy++) {
      for (let i = 0; i < numCopies; i++) {
        const span = document.createElement('span');
        span.textContent = text + '\u00A0';
        fragment.appendChild(span);
      }
    }
    scroller.appendChild(fragment);
    parallax.appendChild(scroller);
    container.appendChild(parallax);

    if (r % 2 === 1) {
      scroller.style.animationDirection = 'reverse';
    }
  }

  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    .scroller {
      animation: scrollLeft 25s linear infinite;
    }
    @keyframes scrollLeft {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
  `;
  document.head.appendChild(styleSheet);
}

function hideLoader() {
  const loader = document.getElementById('echoLoader');
  const main = document.getElementById('mainContent');
  if (loader) loader.classList.add('hidden');
  if (main) {
    main.style.display = 'block';
    window.dispatchEvent(new Event('resize'));
    initPopInOnScroll();   // 改成滚动可见后再弹出
  }
}

// ==================== 滚动到可视区域再弹出 ====================
function initPopInOnScroll() {
  const animElements = document.querySelectorAll(
    '.pill, .annotation-text, .line-sidebar__item, .hero-cta-right, .section-title, .about-desc, .stat-item, .contact-title, .contact-email, .social-link'
  );

  // ✅ 先给所有元素设置延迟（与之前版本一致）
  animElements.forEach((el, i) => {
    el.style.animationDelay = (i * 0.12) + 's';
    el.classList.add('pre-anim');   // 初始隐藏，避免闪烁
  });

  if (!('IntersectionObserver' in window)) {
    // 不支持时直接弹出
    animElements.forEach(el => {
      el.classList.remove('pre-anim');
      el.classList.add('pop-in');
    });
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // ✅ 先添加动画类，再移除隐藏类，避免闪烁
        entry.target.classList.add('pop-in');
        entry.target.classList.remove('pre-anim');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: [0, 0.15],
    rootMargin: '0px 0px -10% 0px'
  });

  animElements.forEach(el => observer.observe(el));
}

initScrollLoader();

// ==================== 导航栏滚动 ====================
const header = document.getElementById('header');
if (header) window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 50));

// ==================== 覆盖层切换 ====================
function showOverlay(pageId) {
  const loader = document.getElementById('echoLoader');
  if (loader && !loader.classList.contains('hidden')) return;
  document.querySelectorAll('.fullscreen-overlay').forEach(o => o.classList.remove('active'));
  const head = document.getElementById('header');
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('is-active'));
  const activePill = document.querySelector(`.pill[href="#${pageId || 'home'}"]`);
  if (activePill) activePill.classList.add('is-active');
  if (pageId && pageId !== 'home') {
    const overlay = document.getElementById('fullscreen-' + pageId);
    if (overlay) {
      overlay.classList.add('active');
      document.body.classList.add('overlay-open');
      if (head) {
        head.style.background = 'rgba(10,10,15,0.85)';
        head.style.backdropFilter = 'blur(20px)';
        head.style.webkitBackdropFilter = 'blur(20px)';
      }
      history.pushState(null, '', '#' + pageId);
    }
  } else {
    document.body.classList.remove('overlay-open');
    if (head) {
      head.style.background = 'transparent';
      head.style.backdropFilter = 'none';
      head.style.webkitBackdropFilter = 'none';
    }
    history.pushState(null, '', '#');
  }
}
window.addEventListener('popstate', () => showOverlay(window.location.hash.substring(1) || 'home'));
window.addEventListener('load', () => {
  const hash = window.location.hash.substring(1) || 'home';
  if (hash !== 'home') setTimeout(() => showOverlay(hash), 600);
});

// ==================== 序列帧 ====================
const FRAME_COUNT = 120;
const FRAME_PATH = 'images/frames_optimized/frame_';
const FRAME_EXT = '.webp';
const canvas = document.getElementById('heroCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const frames = [];
let loadedCount = 0;
let lastDrawnFrame = -1;
let needsRedraw = true;

for (let i = 0; i < FRAME_COUNT; i++) {
  const img = new Image();
  img.onload = () => {
    loadedCount++;
    if (loadedCount === 1 && canvas) {
      updateCanvasSize();
      drawCurrentFrame();
    }
  };
  img.onerror = () => console.error('❌ 第 ' + i + ' 帧加载失败');
  img.src = FRAME_PATH + String(i).padStart(3, '0') + FRAME_EXT;
  frames.push(img);
}

function getScrollProgress() {
  const hero = document.querySelector('.hero-scroll');
  const heroHeight = hero ? hero.offsetHeight : window.innerHeight * 1.5;
  return Math.max(0, Math.min(1, window.scrollY / (heroHeight * 0.75)));
}

function getCurrentFrameIndex() {
  return Math.min(Math.floor(getScrollProgress() * FRAME_COUNT), FRAME_COUNT - 1);
}

function updateCanvasSize() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawFrame(idx) {
  if (!ctx || !frames[idx]) return;
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  const img = frames[idx];
  const imgRatio = img.width / img.height;
  const canvasRatio = rect.width / rect.height;
  let dw, dh, dx, dy;
  if (imgRatio > canvasRatio) {
    dw = rect.width;
    dh = dw / imgRatio;
    dx = 0;
    dy = (rect.height - dh) / 2;
  } else {
    dh = rect.height;
    dw = dh * imgRatio;
    dx = (rect.width - dw) / 2;
    dy = 0;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawCurrentFrame() {
  const idx = getCurrentFrameIndex();
  if (idx !== lastDrawnFrame || needsRedraw) {
    drawFrame(idx);
    lastDrawnFrame = idx;
    needsRedraw = false;
  }
}

function renderLoop() {
  drawCurrentFrame();
  requestAnimationFrame(renderLoop);
}

if (loadedCount > 0 && canvas) {
  updateCanvasSize();
  renderLoop();
} else {
  const intv = setInterval(() => {
    if (loadedCount > 0 && canvas) {
      clearInterval(intv);
      updateCanvasSize();
      renderLoop();
    }
  }, 100);
}

let scrollRafId = null;
window.addEventListener('scroll', () => {
  if (scrollRafId) return;
  scrollRafId = requestAnimationFrame(() => {
    lastDrawnFrame = -1;
    scrollRafId = null;
  });
});

window.addEventListener('resize', () => {
  if (canvas) {
    updateCanvasSize();
    needsRedraw = true;
  }
});

// ==================== 渐显 ====================
const revealEls = document.querySelectorAll('.section-title, .about-grid, .stat-item');
if (revealEls.length) {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('visible');
    });
  }, { threshold: 0.15 });
  revealEls.forEach(el => {
    el.classList.add('reveal');
    obs.observe(el);
  });
}

// ==================== 文字压力 ====================
(function() {
  function init() {
    const title = document.getElementById('pressureTitle');
    if (!title) return;
    const txt = title.textContent.trim();
    title.innerHTML = '';
    const spans = [];
    for (let c of txt) {
      const span = document.createElement('span');
      span.textContent = c;
      span.style.display = 'inline-block';
      title.appendChild(span);
      spans.push(span);
    }
    let mouse = { x: 0, y: 0 }, cursor = { x: 0, y: 0 };
    const cont = title.parentElement;
    if (cont) {
      const r = cont.getBoundingClientRect();
      mouse.x = r.left + r.width / 2;
      mouse.y = r.top + r.height / 2;
      cursor.x = mouse.x;
      cursor.y = mouse.y;
    }
    window.addEventListener('mousemove', e => {
      cursor.x = e.clientX;
      cursor.y = e.clientY;
    });
    const dist = (a,b) => Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2);
    const getA = (d, max, min, maxV) => Math.max(min, maxV - Math.abs((maxV*d)/max) + min);
    function anim() {
      mouse.x += (cursor.x - mouse.x) / 15;
      mouse.y += (cursor.y - mouse.y) / 15;
      const r = title.getBoundingClientRect();
      const maxD = r.width / 2;
      spans.forEach(s => {
        const rs = s.getBoundingClientRect();
        const ctr = { x: rs.x + rs.width/2, y: rs.y + rs.height/2 };
        const d = dist(mouse, ctr);
        const wght = Math.floor(getA(d, maxD, 150, 900));
        const wdth = Math.floor(getA(d, maxD, 50, 200));
        const slnt = getA(d, maxD, 0, 10).toFixed(2);
        s.style.fontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}, 'slnt' ${slnt}`;
      });
      requestAnimationFrame(anim);
    }
    anim();
  }
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();

// ==================== 全屏图片滚轮拦截 ====================
(function() {
  const imageModal = document.getElementById('imageModal');
  if (!imageModal) return;
  imageModal.addEventListener('wheel', function(e) {
    e.preventDefault();
    e.stopPropagation();
    imageModal.scrollTop += e.deltaY;
  }, { passive: false });
})();

// ==================== 环形画廊 + LineSidebar + 视频播放 ====================
(function() {
  const THUMB_PATH = 'images/gallery-thumbnails';
  const FULL_PATH = 'images/gallery-fullscreen';
  const VIDEO_PATH = 'images/gallery-videos';

  const IMAGE_COUNTS = {
    '3D-design': 4,
    'Graphic-design': 8,
    'KV-design': 12,
    'VM-design': 8,
    'Motion-design': 6
  };

  const container = document.getElementById('circularGalleryContainer');
  if (!container) return;
  let galleryApp = null, loadedThis = 0, expecting = 0, timeout = null;
  let currentCategory = '3D-design';

  function buildImageData(categoryKey) {
    const cnt = IMAGE_COUNTS[categoryKey] || 6;
    const arr = [];
    for (let i = 1; i <= cnt; i++) {
      const n = String(i).padStart(2, '0');
      arr.push({
        thumb: `${THUMB_PATH}/${categoryKey}/${n}.png`,
        full: `${FULL_PATH}/${categoryKey}/${n}.png`
      });
    }
    return arr;
  }

  window.notifyImageLoaded = () => {
    loadedThis++;
    if (loadedThis >= expecting) {
      clearTimeout(timeout);
      setTimeout(hideLoader, 800);
    }
  };

  timeout = setTimeout(() => {
    if (document.getElementById('echoLoader') && !document.getElementById('echoLoader').classList.contains('hidden')) {
      console.warn('⏰ 加载超时，强制显示主内容');
      hideLoader();
    }
  }, 8000);

  async function initGallery(key) {
    loadedThis = 0;
    currentCategory = key;
    const data = buildImageData(key);
    expecting = data.length;

    if (galleryApp) { galleryApp.destroy(); galleryApp = null; }
    container.innerHTML = '';

    const { CircularGalleryApp } = await import('./circularGallery.js');
    galleryApp = new CircularGalleryApp(container, {
      items: data.map(d => ({ image: d.thumb, text: '' })),
      bend: 3,
      textColor: '#fff',
      borderRadius: 0.05,
      font: 'bold 30px Inter'
    });
    window.__galleryImageData = data;
    window.__galleryApp = galleryApp;
  }

  const CATEGORY_ORDER = ['3D-design', 'Graphic-design', 'KV-design', 'VM-design', 'Motion-design'];
  initGallery(CATEGORY_ORDER[0]);

  // ==================== 点击放大 ====================
  const galleryEl = container;
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  const modalVideo = document.getElementById('modalVideo');
  let mDown = null;

  galleryEl.addEventListener('mousedown', e => {
    mDown = { x: e.clientX, y: e.clientY };
  });

  galleryEl.addEventListener('click', e => {
    if (mDown && (Math.abs(e.clientX - mDown.x) > 5 || Math.abs(e.clientY - mDown.y) > 5)) {
      mDown = null;
      return;
    }
    mDown = null;

    const rect = galleryEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (!window.__galleryApp) return;
    const idx = window.__galleryApp.getItemIndexAtScreenX(x);
    if (idx < 0 || !window.__galleryImageData[idx]) return;

    if (modalVideo) {
      modalVideo.pause();
      modalVideo.removeAttribute('src');
    }

    if (currentCategory === 'Motion-design') {
      const videoSrc = `${VIDEO_PATH}/Motion-design/${String(idx + 1).padStart(2, '0')}.mp4`;
      modalImg.style.display = 'none';
      modalVideo.style.display = 'block';
      modalVideo.src = videoSrc;
      modalVideo.play();
    } else {
      modalImg.style.display = 'block';
      modalVideo.style.display = 'none';
      modalImg.src = window.__galleryImageData[idx].full;
      modalImg.style.removeProperty('height');
    }

    modal.style.display = 'block';
  });

  function closeModal() {
    modal.style.display = 'none';
    modalImg.src = '';
    if (modalVideo) {
      modalVideo.pause();
      modalVideo.removeAttribute('src');
    }
  }

  modal.addEventListener('click', closeModal);
  modalImg.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
  });

  if (modalVideo) {
    modalVideo.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // ==================== LineSidebar 交互 ====================
  const list = document.querySelector('#lineSidebar .line-sidebar__list');
  const items = document.querySelectorAll('.line-sidebar__item');
  const targets = new Array(items.length).fill(0);
  const currents = new Array(items.length).fill(0);
  let rafId = null, lastTime = 0;
  const ease = t => t * t * (3 - 2 * t);

  function updateEffects() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const smoothing = 100;
    const tau = smoothing / 1000;
    const k = 1 - Math.exp(-dt / tau);
    let moving = false;

    items.forEach((item, i) => {
      const target = targets[i] || (item.classList.contains('active') ? 1 : 0);
      const next = currents[i] + (target - currents[i]) * k;
      const settled = Math.abs(target - next) < 0.001;
      currents[i] = settled ? target : next;
      item.style.setProperty('--effect', currents[i].toFixed(4));
      if (!settled) moving = true;
    });

    if (moving) rafId = requestAnimationFrame(updateEffects);
    else rafId = null;
  }

  function startLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    rafId = requestAnimationFrame(updateEffects);
  }

  if (list) {
    list.addEventListener('pointermove', e => {
      const rect = list.getBoundingClientRect();
      const y = e.clientY - rect.top;
      items.forEach((item, i) => {
        const center = item.offsetTop + item.offsetHeight / 2;
        targets[i] = ease(Math.max(0, 1 - Math.abs(y - center) / 100));
      });
      startLoop();
    });

    list.addEventListener('pointerleave', () => {
      targets.fill(0);
      const activeIdx = [...items].findIndex(el => el.classList.contains('active'));
      if (activeIdx >= 0) targets[activeIdx] = 1;
      startLoop();
    });

    items.forEach((item) => {
      item.addEventListener('click', function() {
        items.forEach((it, i) => {
          it.classList.remove('active');
          targets[i] = 0;
        });
        this.classList.add('active');
        const idx = [...items].indexOf(this);
        targets[idx] = 1;
        const category = this.getAttribute('data-category');
        initGallery(category);
        startLoop();
      });
    });

    items[0].classList.add('active');
    targets[0] = 1;
    startLoop();
  }
})();

// ==================== 主内容等比缩放（不影响全屏浮层） ====================
const BASE_VIEWPORT_WIDTH = 2560; // 4K + 150% 系统缩放后的实际 CSS 宽度

function applyMainScale() {
  const main = document.getElementById('mainContent');
  if (!main) return;

  const scale = Math.min(1, window.innerWidth / BASE_VIEWPORT_WIDTH);

  // 固定主内容宽度为基准宽度
  main.style.width = BASE_VIEWPORT_WIDTH + 'px';
  main.style.transform = 'scale(' + scale + ')';
  main.style.transformOrigin = 'top left';

  // 水平居中
  main.style.marginLeft = ((window.innerWidth - BASE_VIEWPORT_WIDTH * scale) / 2) + 'px';

  // 让页面滚动高度与缩放后的内容高度一致
  document.body.style.height = (main.scrollHeight * scale) + 'px';
  document.body.style.overflowX = 'hidden';
}

window.addEventListener('resize', applyMainScale);
window.addEventListener('load', applyMainScale);
applyMainScale();
