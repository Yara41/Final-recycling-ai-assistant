  // ---------- textures ----------
  function canvasTex(draw, w = 512, h = 512) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; }
  const STONE = canvasTex((x) => {
    x.fillStyle = '#e6d6b8'; x.fillRect(0, 0, 512, 512); const rows = 8, h = 64;
    for (let rr = 0; rr < rows; rr++) { let col = (rr % 2) * -40; while (col < 512) { const w = 70 + rnd() * 70; x.globalAlpha = .35; x.fillStyle = `hsl(38,32%,${84 + rnd() * 10}%)`; x.fillRect(col, rr * h, w, h); x.globalAlpha = 1; x.strokeStyle = 'rgba(120,100,70,.35)'; x.lineWidth = 2; x.strokeRect(col, rr * h, w, h); col += w; } }
    for (let i = 0; i < 3500; i++) { x.fillStyle = `rgba(90,70,40,${rnd() * .08})`; x.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  });
  const PAVE = canvasTex((x) => {
    x.fillStyle = '#d8cbb2'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = `hsl(38,26%,${76 + rnd() * 7}%)`; x.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); }
    for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(100,80,50,${rnd() * .06})`; x.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  }); PAVE.repeat.set(12, 12);
  const GRASS = canvasTex((x) => { x.fillStyle = '#7fa65c'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 6000; i++) { x.fillStyle = `hsl(${85 + rnd() * 20},${35 + rnd() * 15}%,${30 + rnd() * 20}%)`; x.fillRect(rnd() * 256, rnd() * 256, 1.5, 3); } }, 256, 256); GRASS.repeat.set(3, 3);
  const stoneMat = (w, h) => { const t = STONE.clone(); t.needsUpdate = true; t.repeat.set(w / 6, h / 4); return new T.MeshStandardMaterial({ map: t, roughness: .92 }); };
  const M = (color, rough = .9, extra = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: rough }, extra));
  const shadowy = (m) => { m.castShadow = m.receiveShadow = true; return m; };

  // ---------- campus ----------
  function arcadeShape(w, h, n, archW, archH) {
    const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
    for (let i = 0; i < n; i++) { const cx = -w / 2 + (w / n) * (i + .5), rr = archW / 2, p = new T.Path(); p.moveTo(cx - rr, 0); p.lineTo(cx - rr, archH - rr); p.absarc(cx, archH - rr, rr, Math.PI, 0, true); p.lineTo(cx + rr, 0); p.lineTo(cx - rr, 0); s.holes.push(p); }
    return s;
  }
  const wins = [];
  function building({ w, d, h, x, z, ry = 0, arches = 5, name }) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const main = shadowy(new T.Mesh(new T.BoxGeometry(w, h, d), stoneMat(w, h))); main.position.y = h / 2; g.add(main);
    const cor = shadowy(new T.Mesh(new T.BoxGeometry(w + .5, .35, d + .5), M('#e2d1b0'))); cor.position.y = h + .1; g.add(cor);
    const arcH = 3.2;
    const arc = shadowy(new T.Mesh(new T.ExtrudeGeometry(arcadeShape(w, arcH, arches, (w / arches) * .62, arcH * .82), { depth: .6, bevelEnabled: false }), stoneMat(w, arcH))); arc.position.set(0, 0, d / 2 + 1.2); g.add(arc);
    const roof = shadowy(new T.Mesh(new T.BoxGeometry(w, .3, 1.8), M('#dfcdab'))); roof.position.set(0, arcH + .15, d / 2 + .9); g.add(roof);
    const back = new T.Mesh(new T.PlaneGeometry(w, arcH), M('#6d6252', 1)); back.position.set(0, arcH / 2, d / 2 + .02); g.add(back);
    const wm = M('#3d5566', .25, { metalness: .4, emissive: '#ffc983', emissiveIntensity: 0 }); wins.push(wm);
    const floors = Math.max(1, Math.floor((h - arcH - .6) / 2.2)), cols = Math.max(2, Math.floor(w / 2.4)), wg = new T.BoxGeometry(1, 1.4, .12);
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) { const m = new T.Mesh(wg, wm); m.position.set(-w / 2 + (w / cols) * (c + .5), arcH + 1.4 + f * 2.2, d / 2 + .03); g.add(m); }
    scene.add(g);
    g.updateMatrixWorld();
    g.userData = { name, top: new T.Vector3(0, h + 1.2, d / 2).applyMatrix4(g.matrixWorld), front: new T.Vector3(0, 0, d / 2 + 3).applyMatrix4(g.matrixWorld) };
    return g;
  }
  const leafMat = M('#2f5236', .95), oliveLeaf = M('#8fa47c', .95), barkMat = M('#7a6a58', 1);
  const cypressGeo = new T.LatheGeometry([[0, 0], [.5, .4], [.7, 1.6], [.62, 3.2], [.42, 4.6], [.14, 5.6], [0, 5.9]].map(([a, b]) => new T.Vector2(a, b)), 14);
  const sway = [];
  function cypress(x, z, s = 1) { const m = shadowy(new T.Mesh(cypressGeo, leafMat)); m.position.set(x, .3, z); m.scale.setScalar(s); scene.add(m); sway.push({ m, p: rnd() * 6, a: .015 }); return m; }
  function olive(x, z, s = 1) {
    const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
    const tr = shadowy(new T.Mesh(new T.CylinderGeometry(.14, .24, 1.6, 7), barkMat)); tr.position.y = .8; tr.rotation.z = .12; g.add(tr);
    [[0, 2, 0, 1], [.7, 1.8, .2, .7], [-.6, 1.9, -.2, .75], [.1, 2.5, .3, .6]].forEach(([a, b, c, rr]) => { const m = shadowy(new T.Mesh(new T.IcosahedronGeometry(rr, 2), oliveLeaf)); m.position.set(a, b, c); g.add(m); });
    scene.add(g); sway.push({ m: g, p: rnd() * 6, a: .02 }); return g;
  }
  const BIN = { general: '#4b5563', paper: '#2f8f4e', plastic: '#1f6fd1', metal: '#d9a514' };
  const BIN_NAME = { general: 'نفايات عامة', paper: 'ورق وكرتون', plastic: 'بلاستيك', metal: 'معادن' };
  const labelTex = {};
  Object.keys(BIN).forEach((k) => { labelTex[k] = canvasTex((x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#13284a'; x.textAlign = 'center'; x.direction = 'rtl'; x.font = '700 64px "IBM Plex Sans Arabic", sans-serif'; x.fillText(BIN_NAME[k], w / 2, h / 2 + 22); }, 512, 256); });
  function binSet(x, z, ry = 0, full = false) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    Object.entries(BIN).forEach(([kind, c], i) => {
      const b = new T.Group(); b.position.x = (i - 1.5) * 1.05;
      const body = shadowy(new T.Mesh(new T.BoxGeometry(.85, 1.15, .8), M(c, .55))); body.position.y = .58; b.add(body);
      const lid = shadowy(new T.Mesh(new T.BoxGeometry(.95, .12, .9), M(c, .45))); lid.position.y = 1.2; if (full && i === 1) { lid.rotation.x = -.9; lid.position.set(0, 1.45, -.45); } b.add(lid);
      const lab = new T.Mesh(new T.PlaneGeometry(.66, .33), M('#ffffff', .6, { map: labelTex[kind] })); lab.position.set(0, .72, .41); b.add(lab); b.userData.kind = kind; b.userData.lid = lid;
      if (full && i === 1) for (let k = 0; k < 9; k++) { const s = shadowy(new T.Mesh(new T.DodecahedronGeometry(.16 + rnd() * .12), M(['#d9d2c3', '#9fd8ff', '#c9a36b', '#e8e8e8'][k % 4], .7))); s.position.set((rnd() - .5) * .8, 1.25 + rnd() * .35, (rnd() - .5) * .6); b.add(s); }
      g.add(b);
    });
    scene.add(g); return g;
  }
  const lampHeads = [], lampLights = [];
  function lamp(x, z) {
    const pole = new T.Mesh(new T.CylinderGeometry(.05, .07, 3.2, 8), M('#2c2f33', .6)); pole.position.set(x, 1.6, z); scene.add(pole);
    const hm = M('#fff3d6', .5, { emissive: '#ffcf7a', emissiveIntensity: 0 }); lampHeads.push(hm);
    const head = new T.Mesh(new T.SphereGeometry(.22, 12, 10), hm); head.position.set(x, 3.3, z); scene.add(head);
    const pl = new T.PointLight('#ffcf7a', 0, 14, 2); pl.position.set(x, 3.1, z); scene.add(pl); lampLights.push(pl);
  }

  const ground = new T.Mesh(new T.CircleGeometry(90, 72), M('#d8cbb2', .95, { map: PAVE })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const lawns = [[-9, 6, 7, 5], [9, 6, 7, 5], [0, -4, 10, 3], [-17, 12, 6, 6], [17, 12, 6, 6]];
  lawns.forEach(([x, z, w, d]) => {
    const k = new T.Mesh(new T.BoxGeometry(w + .3, .2, d + .3), M('#d4c5a8')); k.position.set(x, .08, z); k.receiveShadow = true; scene.add(k);
    const t = GRASS.clone(); t.needsUpdate = true; t.repeat.set(w / 3, d / 3);
    const m = new T.Mesh(new T.BoxGeometry(w, .25, d), M('#ffffff', 1, { map: t })); m.position.set(x, .13, z); m.receiveShadow = true; scene.add(m);
  });
  const faculties = [
    building({ w: 22, d: 9, h: 9.5, x: 0, z: -16, arches: 7, name: ['الهندسة', 312, 27] }),
    building({ w: 16, d: 8, h: 8, x: -19, z: -2, ry: Math.PI / 2, arches: 5, name: ['الأعمال', 208, 2] }),
    building({ w: 16, d: 8, h: 11, x: 19, z: -3, ry: -Math.PI / 2, arches: 5, name: ['الطب', 96, 3] }),
    building({ w: 12, d: 8, h: 7, x: -24, z: -26, ry: .5, arches: 4, name: ['الآداب', 140, 5] }),
    building({ w: 12, d: 8, h: 8.5, x: 24, z: -26, ry: -.5, arches: 4, name: ['العلوم', 175, 8] }),
  ];
  [[-6, -9.5], [6, -9.5], [-13, -10], [13, -10], [-14.5, 10], [14.5, 10], [-28, -8], [28, -8], [-4, -27], [4, -27], [-10, -28], [10, -28], [-30, 6], [30, 6]].forEach(([x, z], i) => cypress(x, z, .85 + (i % 3) * .12));
  [[-9, 6], [9, 6], [-3, -4], [3.5, -4], [-17, 12], [17, 12]].forEach(([x, z]) => olive(x, z, 1.15));
  const mainBins = binSet(0, 3.5);
  binSet(-12.4, 1, Math.PI / 2, true);
  [[-5, 2], [5, 2], [-12, -6], [12, -6], [-12, 9], [12, 9]].forEach(([x, z]) => lamp(x, z));
  const bench = M('#8a6a4a', .8);
  [[-9, 2.6], [9, 2.6]].forEach(([x, z]) => { const m = shadowy(new T.Mesh(new T.BoxGeometry(2.4, .15, .6), bench)); m.position.set(x, .55, z); scene.add(m); const s = new T.Mesh(new T.BoxGeometry(2.2, .5, .4), M('#d4c5a8')); s.position.set(x, .25, z); scene.add(s); });

  // people walking
  const people = [];
  const cloth = ['#3b5b8c', '#c8553d', '#2f6f5e', '#e0b44c', '#6b4f8c', '#f2efe8', '#394150'];
  for (let i = 0; i < 0; i++) {
    const p = new T.Group();
    const body = shadowy(new T.Mesh(new T.CylinderGeometry(.18, .22, 1.05, 10), M(cloth[i % cloth.length], .8))); body.position.y = .95; p.add(body);
    const legs = shadowy(new T.Mesh(new T.CylinderGeometry(.16, .14, .5, 8), M('#2b2f38', .8))); legs.position.y = .25; p.add(legs);
    const head = shadowy(new T.Mesh(new T.SphereGeometry(.17, 12, 10), M(['#c99b74', '#8d5f3e', '#e2b896'][i % 3], .7))); head.position.y = 1.65; p.add(head);
    scene.add(p);
    people.push({ p, r: 7 + rnd() * 14, a: rnd() * 6.28, sp: (.04 + rnd() * .05) * (i % 2 ? 1 : -1), cz: -2 + rnd() * 6 });
  }
  // the flying bottle
  const bottle = shadowy(new T.Mesh(new T.LatheGeometry([[0, 0], [.13, 0], [.14, .05], [.14, .42], [.06, .55], [.05, .66], [0, .66]].map(([a, b]) => new T.Vector2(a, b)), 16), M('#a9dcff', .1, { metalness: .1, transparent: true, opacity: .85 })));
  bottle.scale.setScalar(1.3); bottle.visible = false; scene.add(bottle);
  const blueBin = new T.Vector3(.52, 1.25, 3.5);

  // ---------- sky and time of day ----------
  const skyCan = document.createElement('canvas'); skyCan.width = 2; skyCan.height = 256; const sx = skyCan.getContext('2d');
  const skyTex = new T.CanvasTexture(skyCan); skyTex.encoding = T.sRGBEncoding; scene.background = skyTex;
  scene.fog = new T.Fog('#dcf0f8', 70, 190);
  const hemi = new T.HemisphereLight('#bfe3ff', '#b49c74', .55); scene.add(hemi);
  const sun = new T.DirectionalLight('#ffe9c7', 2.4); sun.castShadow = true; sun.shadow.mapSize.set(isPhone ? 1024 : 2048, isPhone ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02; scene.add(sun);
  const KEYS = {
    night: { top: '#060a1a', hor: '#1b2a50', sun: '#9fb4ff', si: .28, hi: .2, el: 32, az: 40, win: 1.6, fog: '#121a33', dark: true },
    dawn: { top: '#5a78b8', hor: '#ffc7a1', sun: '#ffc08a', si: 1.4, hi: .4, el: 10, az: -60, win: .5, fog: '#f0cdb6', dark: false },
    day: { top: '#2fb3e3', hor: '#e4f5fb', sun: '#ffe9c7', si: 2.4, hi: .55, el: 38, az: -35, win: 0, fog: '#dcf0f8', dark: false },
    sunset: { top: '#45549a', hor: '#ffad74', sun: '#ff9257', si: 1.6, hi: .42, el: 8, az: 60, win: .7, fog: '#e7b291', dark: true },
  };
  // timeline across 24h: [hour, key]
  const DAYLINE = [[0, 'night'], [4.75, 'night'], [6, 'dawn'], [7.5, 'day'], [16.5, 'day'], [18, 'sunset'], [19.5, 'night'], [24, 'night']];
  function mix(a, b, k) {
    const out = {}; for (const key of Object.keys(a)) { const va = a[key], vb = b[key]; out[key] = typeof va === 'number' ? va + (vb - va) * k : typeof va === 'boolean' ? (k < .5 ? va : vb) : '#' + new T.Color(va).lerp(new T.Color(vb), k).getHexString(); } return out;
  }
  function stateAt(hour) { for (let i = 0; i < DAYLINE.length - 1; i++) { const [h0, k0] = DAYLINE[i], [h1, k1] = DAYLINE[i + 1]; if (hour >= h0 && hour <= h1) { const k = h1 === h0 ? 0 : (hour - h0) / (h1 - h0); return mix(KEYS[k0], KEYS[k1], k * k * (3 - 2 * k)); } } return KEYS.day; }
  function applySky(s) {
    const gg = sx.createLinearGradient(0, 0, 0, 256); gg.addColorStop(0, s.top); gg.addColorStop(1, s.hor); sx.fillStyle = gg; sx.fillRect(0, 0, 2, 256); skyTex.needsUpdate = true;
    scene.fog.color.set(s.fog); sun.color.set(s.sun); sun.intensity = s.si; hemi.intensity = s.hi;
    const el = s.el * Math.PI / 180, az = s.az * Math.PI / 180; sun.position.set(Math.sin(az) * 60 * Math.cos(el), 60 * Math.sin(el) + 4, Math.cos(az) * 60 * Math.cos(el));
    wins.forEach((m) => { m.emissiveIntensity = s.win; }); lampHeads.forEach((m) => { m.emissiveIntensity = s.win * 1.5; }); lampLights.forEach((l) => { l.intensity = s.win * 1.8; });
    document.body.classList.toggle('dark', s.dark);
    $('shade').style.background = s.dark
      ? (isPhone ? 'linear-gradient(0deg, rgba(5,10,25,.82) 0%, rgba(5,10,25,.35) 42%, rgba(5,10,25,0) 62%)' : 'linear-gradient(270deg, rgba(5,10,25,.7) 0%, rgba(5,10,25,.25) 40%, rgba(5,10,25,0) 60%)')
      : (isPhone ? 'linear-gradient(0deg, rgba(240,249,252,.94) 0%, rgba(240,249,252,.55) 42%, rgba(240,249,252,0) 62%)' : 'linear-gradient(270deg, rgba(240,249,252,.85) 0%, rgba(240,249,252,.3) 40%, rgba(240,249,252,0) 60%)');
  }
  const MODES = [['auto', 'تلقائي'], ['day', 'نهار'], ['sunset', 'مغرب'], ['night', 'ليل'], ['dawn', 'فجر']];
  const ICONS = { day: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', night: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>', sunset: '<path d="M17 18a5 5 0 00-10 0M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 5l-4-4-4 4"/>', dawn: '<path d="M17 18a5 5 0 00-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/>' };
  let mode = 0;
  const hourNow = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  function current() { const m = MODES[mode][0]; return m === 'auto' ? stateAt(hourNow()) : KEYS[m]; }
  function phaseName(h) { return h < 4.75 || h >= 19.5 ? 'night' : h < 7 ? 'dawn' : h < 16.5 ? 'day' : 'sunset'; }
  function refreshClock() { const m = MODES[mode][0]; const ph = m === 'auto' ? phaseName(hourNow()) : m; $('clock-ic').innerHTML = ICONS[ph]; $('clock-tx').textContent = MODES[mode][1]; }
  $('clock').addEventListener('click', () => { mode = (mode + 1) % MODES.length; refreshClock(); applySky(current()); });
  refreshClock(); applySky(current()); setInterval(() => { if (mode === 0) { refreshClock(); applySky(current()); } }, 60000);

