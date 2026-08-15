(function() {
  const container = document.getElementById('particlesContainer');
  if (!container) {
    console.error('❌ 找不到 particlesContainer');
    return;
  }
  console.log('✅ 找到 particlesContainer');

  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '0';
  canvas.style.pointerEvents = 'auto'; // 确保能接收鼠标事件
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  const count = 150;

  // 鼠标状态
  let mouse = { x: -1000, y: -1000, active: false };

  function resize() {
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
    initParticles();
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: Math.random() * 2 + 1.5
      });
    }
  }

  // 绑定鼠标事件（直接绑定到 canvas 上更稳定）
  canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
    // console.log('🖱️ 鼠标位置:', mouse.x, mouse.y);
  });

  canvas.addEventListener('mouseleave', function() {
    mouse.active = false;
    mouse.x = -1000;
    mouse.y = -1000;
  });

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < count; i++) {
      const p = particles[i];

      // 只有鼠标激活时才计算排斥
      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 200) {
          const force = (200 - dist) / 200;
          p.vx += (dx / dist) * force * 0.8; // 排斥力度
          p.vy += (dy / dist) * force * 0.8;
        }
      }

      p.x += p.vx;
      p.y += p.vy;

      // 边界反弹
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
    }
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize);
  resize();
  animate();

  console.log('🚀 粒子动画已启动，请移动鼠标测试');
})();