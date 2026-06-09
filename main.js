(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const screens = {
    gate:    $('gate'),
    tree:    $('treeScreen'),
    letter:  $('letterScreen'),
    flowers: $('flowersScreen'),
  };

  let activeScreen = 'gate';
  let treeHandle = null;

  function switchTo(name, callback) {
    const from = screens[activeScreen];
    const to   = screens[name];

    gsap.to(from, {
      opacity: 0, duration: 0.45, ease: 'power2.in',
      onComplete() { from.classList.remove('active'); },
    });

    activeScreen = name;

    gsap.delayedCall(0.32, () => {
      to.classList.add('active');
      gsap.fromTo(to, { opacity: 0 }, {
        opacity: 1, duration: 0.55, ease: 'power2.out',
        onComplete: callback,
      });
    });
  }

  function initGateParticles() {
    const canvas = $('gateCanvas');
    const ctx = canvas.getContext('2d');
    let W, H;

    const particles = Array.from({ length: 75 }, () => makeParticle(true));

    function makeParticle(random) {
      return {
        x:    Math.random() * (W || window.innerWidth),
        y:    random ? Math.random() * (H || window.innerHeight) : (H || window.innerHeight) + 4,
        r:    0.5 + Math.random() * 1.4,
        vy:   0.18 + Math.random() * 0.3,
        vx:   (Math.random() - 0.5) * 0.18,
        wave: Math.random() * Math.PI * 2,
        op:   0.2 + Math.random() * 0.5,
      };
    }

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.y   -= p.vy;
        p.wave += 0.015;
        p.x   += Math.sin(p.wave) * 0.28 + p.vx;
        if (p.y < -4) Object.assign(p, makeParticle(false));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,169,110,${p.op})`;
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();
  }

  function initGate() {
    const input = $('passwordInput');
    const errEl = $('gateError');

    input.addEventListener('input', function () {
      let digits = this.value.replace(/\D/g, '').slice(0, 6);
      if (digits.length >= 5)      digits = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
      else if (digits.length >= 3) digits = digits.slice(0,2) + '/' + digits.slice(2);
      this.value = digits;
    });

    function attempt() {
      if (input.value.replace(/\//g, '').trim() === CONFIG.password) {
        gsap.to(screens.gate, {
          opacity: 0, scale: 0.98, duration: 0.5, ease: 'power2.in',
          onComplete() {
            screens.gate.classList.remove('active');
            initTreeScreen();
          },
        });
      } else {
        gsap.to(input, {
          duration: 0.055, x: 9, yoyo: true, repeat: 7, ease: 'none',
          onComplete: () => gsap.set(input, { x: 0 }),
        });
        errEl.classList.add('show');
        input.value = '';
        setTimeout(() => errEl.classList.remove('show'), 2200);
      }
    }

    $('submitBtn').addEventListener('click', attempt);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
    input.focus();
  }

  function initTreeScreen() {
    activeScreen = 'tree';
    screens.tree.classList.add('active');
    gsap.fromTo(screens.tree, { opacity: 0 }, { opacity: 1, duration: 0.7 });

    const audio = $('treeAudio');
    audio.src = CONFIG.audio.tree;
    audio.volume = 0.35;
    audio.play().catch(() => {});

    $('toLetterBtn').addEventListener('click', () => {
      treeHandle?.dispose();
      treeHandle = null;
      audio.pause();
      switchTo('letter', initLetterScreen);
    });

    try {
      treeHandle = buildThreeScene();
    } catch (err) {
      console.warn('Memory Tree: 3-D scene could not be initialised.', err);
    }
  }

  function buildThreeScene() {
    const canvas = $('treeCanvas');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x071207, 0.052);

    const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 80);
    camera.position.set(0, 4, 14);
    camera.lookAt(0, 3, 0);

    scene.add(new THREE.AmbientLight(0x88cc88, 0.55));
    const sun = new THREE.DirectionalLight(0xe8f4cc, 0.9);
    sun.position.set(6, 12, 8);
    scene.add(sun);
    const fill = new THREE.PointLight(0x44cc44, 0.4, 22);
    fill.position.set(-6, 6, 4);
    scene.add(fill);
    const warm = new THREE.PointLight(0xffcc88, 0.5, 14);
    warm.position.set(4, 2, 6);
    scene.add(warm);

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3c1e08 });
    const leafColors = [0x2b5e18, 0x3a7820, 0x4a9028, 0x1e480e];
    const leafMats = leafColors.map(c => new THREE.MeshLambertMaterial({ color: c }));

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshLambertMaterial({ color: 0x0a1608 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.35;
    scene.add(ground);

    function addBranch(from, to, rBot, rTop) {
      const dir = new THREE.Vector3().subVectors(to, from);
      const len = dir.length();
      const geo = new THREE.CylinderGeometry(rTop, rBot, len, 7, 1);
      const mesh = new THREE.Mesh(geo, trunkMat);
      mesh.position.copy(new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      scene.add(mesh);
    }

    function addLeaves(x, y, z, r) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 7, 5),
        leafMats[Math.floor(Math.random() * leafMats.length)]
      );
      mesh.position.set(x, y, z);
      scene.add(mesh);
    }

    const root = new THREE.Vector3(0, 0, 0);
    addBranch(root, new THREE.Vector3(0, 4.6, 0), 0.52, 0.3);

    const branchDefs = [
      { from: [0, 2.2, 0], to: [-3.3, 4.3,  0.8], r: [0.22, 0.11] },
      { from: [0, 2.6, 0], to: [ 3.1, 4.1, -0.6], r: [0.22, 0.11] },
      { from: [0, 3.2, 0], to: [-2.1, 5.5, -1.2], r: [0.17, 0.09] },
      { from: [0, 3.4, 0], to: [ 2.3, 5.7,  1.0], r: [0.17, 0.09] },
      { from: [0, 4.0, 0], to: [ 0.7, 6.3, -0.4], r: [0.13, 0.07] },
      { from: [0, 4.2, 0], to: [-1.3, 6.5,  0.9], r: [0.13, 0.07] },
    ];

    const tips = branchDefs.map(b => {
      const from = new THREE.Vector3(...b.from);
      const to   = new THREE.Vector3(...b.to);
      addBranch(from, to, b.r[0], b.r[1]);
      return to.clone();
    });

    tips.forEach(t => {
      addLeaves(t.x,        t.y + 0.65, t.z,        1.3 + Math.random() * 0.5);
      addLeaves(t.x + 0.4,  t.y,        t.z + 0.3,  0.85 + Math.random() * 0.3);
      addLeaves(t.x - 0.3,  t.y + 0.1,  t.z - 0.2,  0.75 + Math.random() * 0.3);
    });
    addLeaves(0, 7.4, 0, 2.1);
    addLeaves(0.9, 6.7, 0.6, 1.3);
    addLeaves(-0.8, 6.9, -0.5, 1.2);

    const attachmentPoints = CONFIG.memories.map((_, i) => {
      const count = Math.max(CONFIG.memories.length - 1, 1);
      const progress = i / count;
      const angle = progress * Math.PI * 2.35 + (i % 2 ? 0.22 : -0.18);
      const radius = 1.35 + (i % 4) * 0.28;
      const height = 2.15 + progress * 3.55 + Math.sin(i * 1.1) * 0.18;
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      );
    });

    const texLoader = new THREE.TextureLoader();
    const photoGroups = [];
    const FW = 1.15, FH = 1.35;

    CONFIG.memories.forEach((mem, i) => {
      const tip = attachmentPoints[i];
      const support = new THREE.Vector3(tip.x * 0.45, tip.y - 0.2, tip.z * 0.45);
      addBranch(support, tip, 0.06, 0.03);

      const group = new THREE.Group();
      group.position.set(tip.x, tip.y - 1.0, tip.z);
      group.rotation.y = (Math.random() - 0.5) * 0.9;
      group.userData.baseRotY = group.rotation.y;
      group.userData.memIndex = i;

      group.add(new THREE.Mesh(
        new THREE.PlaneGeometry(FW, FH),
        new THREE.MeshLambertMaterial({ color: 0xfaf6f0, side: THREE.DoubleSide })
      ));

      const photoGeo = new THREE.PlaneGeometry(FW * 0.82, FW * 0.82);

      function attachPhoto(texture) {
        const mat = texture
          ? new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide })
          : new THREE.MeshLambertMaterial({
              color: mem.type === 'video' ? 0x3a5272 : 0xc8b8a4,
              side: THREE.DoubleSide,
            });
        const photoMesh = new THREE.Mesh(photoGeo, mat);
        photoMesh.position.set(0, 0.08, 0.003);
        group.add(photoMesh);

        if (mem.type === 'video') {
          const iconMesh = new THREE.Mesh(
            new THREE.CircleGeometry(0.13, 16),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
          );
          iconMesh.position.set(0, 0.08, 0.006);
          group.add(iconMesh);
        }
      }

      if (mem.type === 'image') {
        texLoader.load(mem.src, tex => attachPhoto(tex), undefined, () => attachPhoto(null));
      } else {
        attachPhoto(null);
      }

      const strGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, FH / 2, 0),
        new THREE.Vector3(0, FH / 2 + 0.45, 0),
      ]);
      group.add(new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: 0x5a3010 })));

      scene.add(group);
      photoGroups.push(group);
    });

    const LEAF_COUNT = 75;
    const lPos = new Float32Array(LEAF_COUNT * 3);
    const lVel = [];
    for (let i = 0; i < LEAF_COUNT; i++) {
      lPos[i * 3]     = (Math.random() - 0.5) * 15;
      lPos[i * 3 + 1] = Math.random() * 10;
      lPos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      lVel.push({
        x: (Math.random() - 0.5) * 0.006,
        y: -(0.008 + Math.random() * 0.006),
        z: (Math.random() - 0.5) * 0.006,
      });
    }
    const leafGeo = new THREE.BufferGeometry();
    leafGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
    scene.add(new THREE.Points(
      leafGeo,
      new THREE.PointsMaterial({ color: 0x5cbb5c, size: 0.09, transparent: true, opacity: 0.62 })
    ));

    const raycaster = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    let orbitY = 0, targetOrbitY = 0, orbitStart = 0;
    let downX = 0, downY = 0, dragging = false;

    function pxy(e) {
      const s = e.touches ? e.touches[0] : e;
      return { x: s.clientX, y: s.clientY };
    }

    function onDown(e) {
      const p = pxy(e);
      downX = p.x; downY = p.y;
      orbitStart = targetOrbitY;
      dragging = false;
    }
    function onMove(e) {
      const p = pxy(e);
      if (Math.abs(p.x - downX) > 5) {
        dragging = true;
        targetOrbitY = orbitStart - (p.x - downX) * 0.005;
      }
    }
    function onUp(e) {
      if (!dragging) {
        const p = e.changedTouches ? e.changedTouches[0] : e;
        ptr.x =  (p.clientX / window.innerWidth)  * 2 - 1;
        ptr.y = -(p.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(ptr, camera);
        const meshes = photoGroups.flatMap(g => g.children.filter(c => c.isMesh));
        const hits   = raycaster.intersectObjects(meshes, false);
        if (hits.length) {
          const parent = hits[0].object.parent;
          if (parent?.userData.memIndex !== undefined) {
            openModal(CONFIG.memories[parent.userData.memIndex]);
          }
        }
      }
      dragging = false;
    }

    canvas.addEventListener('mousedown',  onDown);
    canvas.addEventListener('mousemove',  onMove);
    canvas.addEventListener('mouseup',    onUp);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    canvas.addEventListener('touchmove',  onMove, { passive: true });
    canvas.addEventListener('touchend',   onUp);

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let rafId;

    (function tick() {
      rafId = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();

      orbitY += (targetOrbitY - orbitY) * 0.065;
      camera.position.x = Math.sin(orbitY) * 14;
      camera.position.z = Math.cos(orbitY) * 14;
      camera.lookAt(0, 3, 0);

      photoGroups.forEach((g, i) => {
        g.rotation.z = Math.sin(t * 0.55 + i * 1.3) * 0.055;
        g.rotation.y = g.userData.baseRotY + Math.sin(t * 0.38 + i * 0.9) * 0.04;
      });

      const pa = leafGeo.attributes.position.array;
      for (let i = 0; i < LEAF_COUNT; i++) {
        pa[i * 3]     += lVel[i].x;
        pa[i * 3 + 1] += lVel[i].y;
        pa[i * 3 + 2] += lVel[i].z;
        if (pa[i * 3 + 1] < -1) {
          pa[i * 3]     = (Math.random() - 0.5) * 15;
          pa[i * 3 + 1] = 10;
          pa[i * 3 + 2] = (Math.random() - 0.5) * 10;
        }
      }
      leafGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    }());

    return {
      dispose() {
        cancelAnimationFrame(rafId);
        canvas.removeEventListener('mousedown',  onDown);
        canvas.removeEventListener('mousemove',  onMove);
        canvas.removeEventListener('mouseup',    onUp);
        canvas.removeEventListener('touchstart', onDown);
        canvas.removeEventListener('touchmove',  onMove);
        canvas.removeEventListener('touchend',   onUp);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
      },
    };
  }

  function openModal(mem) {
    const modal   = $('mediaModal');
    const content = $('modalContent');
    content.innerHTML = '';

    if (mem.type === 'image') {
      const img = document.createElement('img');
      img.src = mem.src; img.alt = '';
      content.appendChild(img);
    } else {
      const vid = document.createElement('video');
      vid.src = mem.src;
      if (mem.poster) vid.poster = mem.poster;
      vid.controls = true; vid.playsInline = true; vid.autoplay = true;
      content.appendChild(vid);
    }

    modal.classList.add('open');
  }

  function closeModal() {
    const modal = $('mediaModal');
    modal.classList.remove('open');
    setTimeout(() => {
      const vid = $('modalContent').querySelector('video');
      if (vid) vid.pause();
      $('modalContent').innerHTML = '';
    }, 360);
  }

  $('modalClose').addEventListener('click', closeModal);
  $('modalScrim').addEventListener('click', closeModal);

  // ─── FIX 1: Letter screen ───────────────────────────────────────────────────
  // The paper must rise ABOVE the envelope shell (z-index already handles layering,
  // but the translateY destination needs to clear the envelope top).
  // Also guard against empty CONFIG.letter.
  function initLetterScreen() {
    const audio   = $('letterAudio');
    const stage   = $('envelopeStage');
    const shell   = $('envelopeShell');
    const flap    = $('envFlap');
    const seal    = $('envSeal');
    const paper   = $('letterPaper');
    const content = $('letterContent');
    const cursor  = $('typeCursor');
    const prompt  = $('letterPrompt');
    const nav     = $('letterNav');

    audio.src = CONFIG.audio.letter;
    audio.volume = 0.3;
    audio.play().catch(() => {});

    function syncPaperRules() {
      const bodyStyle = window.getComputedStyle(paper.querySelector('.letter-body'));
      const paperStyle = window.getComputedStyle(paper);
      const lineHeight = parseFloat(bodyStyle.lineHeight) || 28;
      const paddingTop = parseFloat(paperStyle.paddingTop) || 0;
      paper.style.setProperty('--rule-gap', `${lineHeight}px`);
      paper.style.setProperty('--rule-offset', `${paddingTop - paper.scrollTop}px`);
    }

    // Reset paper to hidden state inside envelope
    gsap.set(paper, { opacity: 0, y: 0, transformOrigin: '50% 100%' });
    gsap.set(shell, { opacity: 1, y: 0, scale: 1 });
    syncPaperRules();

    let opened = false;

    gsap.to(stage, { scale: 1.015, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });

    stage.addEventListener('click', () => {
      if (opened) return;
      opened = true;

      gsap.killTweensOf(stage);
      gsap.set(stage, { scale: 1 });
      gsap.to(prompt, { opacity: 0, duration: 0.3 });

      // Open flap
      gsap.to(flap, {
        rotationX: -175,
        transformPerspective: 650,
        transformOrigin: '50% 0%',
        duration: 0.72,
        ease: 'power2.inOut',
      });
      gsap.to(seal, { opacity: 0, duration: 0.25, delay: 0.15 });

      // Rise paper out of envelope — translate upward enough to clear the envelope
      const riseAmount = Math.min(window.innerHeight * 0.34, 220);
      gsap.to(paper, {
        opacity: 1,
        y: -riseAmount,
        scale: 1.015,
        duration: 0.9, delay: 0.42,
        ease: 'power4.out',
        onComplete() {
          // Expand paper to full-screen reading mode
          gsap.set(paper, { y: 0 });
          paper.classList.add('letter-paper--open');
          gsap.to(shell, {
            opacity: 0,
            y: 24,
            scale: 0.92,
            duration: 0.42,
            ease: 'power2.inOut',
          });

          const letterText = CONFIG.letter || '';
          if (letterText.length === 0) {
            cursor.style.display = 'none';
            nav.hidden = false;
            gsap.fromTo(nav, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45 });
          } else {
            typeWrite(content, letterText, 16, () => {
              cursor.style.display = 'none';
              // Scroll to top so reader starts from the beginning
              paper.scrollTop = 0;
              syncPaperRules();
              nav.hidden = false;
              gsap.fromTo(nav, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45 });
            });
          }
        },
      });
    });

    paper.addEventListener('scroll', syncPaperRules, { passive: true });

    $('toFlowersBtn').addEventListener('click', () => {
      audio.pause();
      switchTo('flowers', initFlowersScreen);
    });
  }

  function typeWrite(el, text, speed, onDone) {
    let i = 0;
    el.textContent = '';
    const id = setInterval(() => {
      if (i < text.length) {
        el.textContent += text[i++];
        const paper = $('letterPaper');
        paper.scrollTop = paper.scrollHeight;
        const bodyStyle = window.getComputedStyle(paper.querySelector('.letter-body'));
        const paperStyle = window.getComputedStyle(paper);
        const lineHeight = parseFloat(bodyStyle.lineHeight) || 28;
        const paddingTop = parseFloat(paperStyle.paddingTop) || 0;
        paper.style.setProperty('--rule-gap', `${lineHeight}px`);
        paper.style.setProperty('--rule-offset', `${paddingTop - paper.scrollTop}px`);
      }
      if (i >= text.length) { clearInterval(id); onDone?.(); }
    }, speed);
  }

  function initFlowersScreen() {
    const msgEl = $('flowersMessage');
    const wrap  = $('bouquetWrap');
    msgEl.textContent = CONFIG.flowerMessage;

    initPetalCanvas();

    const svg = buildBouquetSVG();
    wrap.appendChild(svg);

    const roses = svg.querySelectorAll('.rose');
    gsap.set(roses, { scale: 0, opacity: 0, transformOrigin: 'bottom center' });
    gsap.to(roses, {
      scale: 1, opacity: 1,
      duration: 0.65, stagger: 0.11,
      ease: 'back.out(1.5)',
    });

    gsap.to(msgEl, {
      opacity: 1,
      delay: roses.length * 0.11 + 0.5,
      duration: 1.2, ease: 'power2.out',
    });

    roses.forEach((r, i) => {
      gsap.to(r, {
        rotation: i % 2 === 0 ? 2.5 : -2.5,
        duration: 2.2 + i * 0.2,
        yoyo: true, repeat: -1,
        ease: 'sine.inOut',
        transformOrigin: 'bottom center',
      });
    });
  }

  function initPetalCanvas() {
    const canvas = $('petalCanvas');
    const ctx = canvas.getContext('2d');
    let W, H;

    const petals = Array.from({ length: 50 }, () => makePetal(true));

    function makePetal(random) {
      return {
        x:     Math.random() * (W || window.innerWidth),
        y:     random ? Math.random() * (H || window.innerHeight) : -(Math.random() * 20),
        r:     3 + Math.random() * 5,
        vy:    0.5 + Math.random() * 0.8,
        vx:    (Math.random() - 0.5) * 0.5,
        spin:  (Math.random() - 0.5) * 0.04,
        angle: Math.random() * Math.PI * 2,
        op:    0.3 + Math.random() * 0.45,
      };
    }

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      petals.forEach(p => {
        p.y     += p.vy;
        p.x     += p.vx;
        p.angle += p.spin;
        if (p.y > H + 10) Object.assign(p, makePetal(false));

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.op})`;
        ctx.fill();
        ctx.restore();
      });
      requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();
  }

  // ─── FIX 2: Bouquet SVG — proper rose shapes ───────────────────────────────
  function buildBouquetSVG() {
    const NS = 'http://www.w3.org/2000/svg';

    function el(tag, attrs, children) {
      const e = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      (children || []).forEach(c => e.appendChild(c));
      return e;
    }

    const svg = el('svg', { viewBox: '0 0 400 520', xmlns: NS });

    // Rose positions: [cx, cy, stemBottomX, petalSize, stemCurveDir]
    const roseDefs = [
      { cx: 200, cy: 78,  sbx: 200, size: 52, dir:  0  },
      { cx: 155, cy: 112, sbx: 190, size: 44, dir: -1  },
      { cx: 245, cy: 112, sbx: 210, size: 44, dir:  1  },
      { cx: 116, cy: 150, sbx: 178, size: 38, dir: -1  },
      { cx: 284, cy: 150, sbx: 222, size: 38, dir:  1  },
      { cx: 174, cy: 155, sbx: 192, size: 32, dir: -1  },
      { cx: 226, cy: 155, sbx: 208, size: 32, dir:  1  },
    ];

    // Draw stems first (behind roses)
    roseDefs.forEach(({ cx, cy, sbx, dir }) => {
      svg.appendChild(el('path', {
        d: `M ${cx} ${cy + 28} Q ${cx + dir * 12} ${cy + 110} ${sbx} 445`,
        stroke: '#2d5c12', 'stroke-width': '3.2',
        fill: 'none', 'stroke-linecap': 'round',
      }));
      // Leaves
      const lx = cx + dir * 24, ly = cy + 90;
      svg.appendChild(el('ellipse', {
        cx: lx, cy: ly, rx: 18, ry: 7, fill: '#3a7020',
        transform: `rotate(${dir * 38} ${lx} ${ly})`,
      }));
      const lx2 = cx + dir * 14, ly2 = cy + 140;
      svg.appendChild(el('ellipse', {
        cx: lx2, cy: ly2, rx: 14, ry: 6, fill: '#2f6018',
        transform: `rotate(${dir * -28} ${lx2} ${ly2})`,
      }));
    });

    // Wrap/ribbon
    svg.appendChild(el('path', {
      d: 'M 148 418 Q 200 432 252 418 L 264 458 Q 200 472 136 458 Z',
      fill: '#c8a96e', opacity: '0.88',
    }));
    svg.appendChild(el('line', {
      x1: '142', y1: '436', x2: '258', y2: '436',
      stroke: '#a8884a', 'stroke-width': '1.6',
    }));
    // Ribbon bow
    svg.appendChild(el('path', {
      d: 'M 185 418 Q 170 406 178 398 Q 186 390 200 402 Q 214 390 222 398 Q 230 406 215 418 Z',
      fill: '#c8a96e', stroke: '#a8884a', 'stroke-width': '1',
    }));

    // Draw roses on top
    roseDefs.forEach(({ cx, cy, size }) => {
      svg.appendChild(buildRose(NS, el, cx, cy, size));
    });

    return svg;
  }

  function buildRose(NS, el, cx, cy, size) {
    const g = el('g', { class: 'rose' });
    const s = size;

    // Helper: create a petal path (teardrop shape) at angle `a`, distance `d` from center
    function petal(d, a, rx, ry, fill, opacity, extraRotate) {
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d;
      const rot = (a * 180 / Math.PI) + 90 + (extraRotate || 0);
      return el('ellipse', {
        cx: px, cy: py,
        rx, ry,
        fill,
        opacity: opacity || '1',
        transform: `rotate(${rot} ${px} ${py})`,
      });
    }

    // Outer guard petals (5) — large, cupped outward
    const outerColors = ['#ffffff', '#f5f5f5', '#fafafa', '#f0f0f0', '#f8f8f8'];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(a) * s * 0.48;
      const py = cy + Math.sin(a) * s * 0.48;
      const rot = (a * 180 / Math.PI) + 90;
      g.appendChild(el('ellipse', {
        cx: px, cy: py,
        rx: s * 0.32, ry: s * 0.42,
        fill: outerColors[i],
        opacity: '0.9',
        transform: `rotate(${rot} ${px} ${py})`,
      }));
    }

    // Middle petals (5, offset by half step) — medium, rising inward
    const midColors = ['#efefef', '#e8e8e8', '#ececec', '#e5e5e5', '#eaeaea'];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2 + Math.PI / 5;
      const px = cx + Math.cos(a) * s * 0.28;
      const py = cy + Math.sin(a) * s * 0.28;
      const rot = (a * 180 / Math.PI) + 90;
      g.appendChild(el('ellipse', {
        cx: px, cy: py,
        rx: s * 0.24, ry: s * 0.32,
        fill: midColors[i],
        opacity: '0.95',
        transform: `rotate(${rot} ${px} ${py})`,
      }));
    }

    // Inner petals (4) — tighter, deeper color, taller/narrower
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 4;
      const px = cx + Math.cos(a) * s * 0.14;
      const py = cy + Math.sin(a) * s * 0.14;
      const rot = (a * 180 / Math.PI) + 90;
      g.appendChild(el('ellipse', {
        cx: px, cy: py,
        rx: s * 0.14, ry: s * 0.22,
        fill: '#d8d8d8',
        opacity: '0.97',
        transform: `rotate(${rot} ${px} ${py})`,
      }));
    }

    // Spiral innermost "furled" petals (3) — very tight, upright
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const px = cx + Math.cos(a) * s * 0.068;
      const py = cy + Math.sin(a) * s * 0.068;
      const rot = (a * 180 / Math.PI) + 90;
      g.appendChild(el('ellipse', {
        cx: px, cy: py,
        rx: s * 0.09, ry: s * 0.15,
        fill: '#cccccc',
        transform: `rotate(${rot} ${px} ${py})`,
      }));
    }

    // Center bud
    g.appendChild(el('circle', { cx, cy, r: s * 0.085, fill: '#c8c8c8' }));
    g.appendChild(el('circle', { cx, cy, r: s * 0.042, fill: '#b0b0b0' }));

    // Sepal base (green calyx)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const px = cx + Math.cos(a) * s * 0.52;
      const py = cy + Math.sin(a) * s * 0.52 + s * 0.18;
      g.appendChild(el('ellipse', {
        cx: px, cy: py,
        rx: s * 0.07, ry: s * 0.18,
        fill: '#3a7020', opacity: '0.7',
        transform: `rotate(${(a * 180 / Math.PI) + 10} ${px} ${py})`,
      }));
    }

    return g;
  }

  initGateParticles();
  initGate();

}());
