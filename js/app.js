// import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js'
// import { openPixelEditor } from './editor.js'

// // ---------------- CONFIG ----------------
// const GRID_W = 32           // limited horizontal area
// const GRID_H = 24           // limited vertical area
// const TILE = 1
// const SESSION_SECONDS = 120

// // palette for drawing editor
// const PALETTE = [
//   '#000000','#FFFFFF','#FF0000','#FF7F00','#FFFF00','#00FF00','#00FFFF','#0000FF',
//   '#8B00FF','#FFC0CB','#FFA500','#FFD700','#7FFF00','#40E0D0','#4169E1','#8A2BE2'
// ]

// // localStorage persistence
// const LS = {
//   k:'pmark_state_v1',
//   load(){try{return JSON.parse(localStorage.getItem(this.k))||{}}catch{return{}}},
//   save(o){localStorage.setItem(this.k,JSON.stringify(o))}
// }
// const stateStore = LS.load()
// stateStore.visitors = (stateStore.visitors || 0)
// LS.save(stateStore)

// if(!sessionStorage.getItem('pm_session_started'))
//   sessionStorage.setItem('pm_session_started', Date.now().toString())

// // ---------------- DOM ----------------
// const mount = document.getElementById('mount')
// const btnPlace = document.getElementById('btnPlace')
// const timerEl = document.getElementById('timer')
// const visitorsEl = document.getElementById('visitors')

// // ---------------- THREE.JS SCENE ----------------
// const renderer = new THREE.WebGLRenderer({ antialias:false })
// mount.innerHTML = ''
// mount.appendChild(renderer.domElement)
// const scene = new THREE.Scene()
// scene.background = new THREE.Color(0x000000) // dark "space" around the map

// // camera (top-down)
// const cam = new THREE.OrthographicCamera(
//   -(GRID_W*TILE)/2, (GRID_W*TILE)/2,
//   (GRID_H*TILE)/2, -(GRID_H*TILE)/2,
//   -100, 100
// )
// cam.position.set(0, 40, 0)
// cam.rotation.x = -Math.PI / 2

// // resize
// function resize(){
//   const w = mount.clientWidth
//   const h = mount.clientHeight
//   renderer.setSize(w, h, false)
// }
// resize()
// addEventListener('resize', resize)

// // ground (bounded prairie)
// const loader = new THREE.TextureLoader()
// const prairie = loader.load('./assets/prairie1.jpg')
// prairie.wrapS = prairie.wrapT = THREE.RepeatWrapping
// prairie.repeat.set(2, 2)
// prairie.magFilter = prairie.minFilter = THREE.NearestFilter
// prairie.colorSpace = THREE.SRGBColorSpace

// const ground = new THREE.Mesh(
//   new THREE.PlaneGeometry(GRID_W*TILE, GRID_H*TILE),
//   new THREE.MeshBasicMaterial({ map: prairie })
// )
// ground.rotation.x = -Math.PI/2
// scene.add(ground)

// // -------------- DECAY (fading prairie) --------------
// function computeDecay(){
//   const marks = (stateStore.marks||[])
//   const visitors = stateStore.visitors || 0
//   return Math.min(1,(marks.length+visitors)*0.03)
// }
// function applyDecay(){
//   const dec = computeDecay()
//   ground.material.onBeforeCompile = (s) => {
//     s.fragmentShader = s.fragmentShader
//       .replace('#include <common>', `#include <common>
// vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);
// vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
// vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
// float d=q.x-min(q.w,q.y);float e=1e-10;
// return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
// vec3 hsv2rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.,1./3.,2./3.))*6.-3.);
// return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}`)
//       .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
//         `vec3 hsv = rgb2hsv(outgoingLight);
//          hsv.y *= (1.0 - ${dec.toFixed(3)} * 0.9);
//          gl_FragColor = vec4(hsv2rgb(hsv), diffuseColor.a);`)
//   }
//   ground.material.needsUpdate = true
// }
// applyDecay()

// // -------------- PLAYER SPRITE --------------
// const playerTex = loader.load('./ui/player_red.PNG')
// playerTex.magFilter = playerTex.minFilter = THREE.NearestFilter
// playerTex.colorSpace = THREE.SRGBColorSpace
// const player = new THREE.Mesh(
//   new THREE.PlaneGeometry(1.5, 1.5),
//   new THREE.MeshBasicMaterial({ map: playerTex, transparent: true })
// )
// player.rotation.x = -Math.PI/2
// scene.add(player)

// // -------------- MARKS --------------
// function addMarkSprite(dataURL, gx, gy){
//   const tex = new THREE.TextureLoader().load(dataURL)
//   tex.magFilter = tex.minFilter = THREE.NearestFilter
//   tex.colorSpace = THREE.SRGBColorSpace
//   const s = new THREE.Mesh(
//     new THREE.PlaneGeometry(2, 2),
//     new THREE.MeshBasicMaterial({ map: tex, transparent: true })
//   )
//   s.rotation.x = -Math.PI/2
//   s.position.set((gx - GRID_W/2 + 0.5)*TILE, 0.11, (gy - GRID_H/2 + 0.5)*TILE)
//   scene.add(s)
// }
// ;(stateStore.marks || []).forEach(m => addMarkSprite(m.data, m.gx, m.gy))

// // -------------- INPUT / MOVEMENT --------------
// let target = { x: Math.floor(GRID_W/2), y: Math.floor(GRID_H/2) }

// function nudge(dx, dy){
//   target.x = Math.max(0, Math.min(GRID_W - 1, target.x + dx))
//   target.y = Math.max(0, Math.min(GRID_H - 1, target.y + dy))
//   player.position.set(
//     (target.x - GRID_W/2 + 0.5)*TILE,
//     0.1,
//     (target.y - GRID_H/2 + 0.5)*TILE
//   )
//   cam.position.x = player.position.x
//   cam.position.z = player.position.z
//   cam.lookAt(player.position.x, 0, player.position.z)
// }

// document.querySelector('.dpad .up').onclick    = () => nudge(0,-1)
// document.querySelector('.dpad .down').onclick  = () => nudge(0, 1)
// document.querySelector('.dpad .left').onclick  = () => nudge(-1,0)
// document.querySelector('.dpad .right').onclick = () => nudge(1, 0)

// btnPlace.onclick = () => {
//   openEditorAt(target.x, target.y)
// }

// // -------------- TIMER & EXIT --------------
// let timeLeft = SESSION_SECONDS
// timerEl.textContent = `${timeLeft}s`
// const tick = setInterval(()=>{
//   timeLeft = Math.max(0, timeLeft - 1)
//   timerEl.textContent = `${timeLeft}s`
//   if(timeLeft === 0){
//     clearInterval(tick)
//     stateStore.visitors = (stateStore.visitors || 0) + 1
//     LS.save(stateStore)
//     location.href = './kicked.html'
//   }
// },1000)
// visitorsEl.textContent = String(stateStore.visitors || 0)

// // -------------- LOOP --------------
// function animate(){
//   renderer.render(scene, cam)
//   requestAnimationFrame(animate)
// }
// animate()

// // -------------- OPEN EDITOR --------------
// function openEditorAt(gx, gy){
//   openPixelEditor({
//     palette: PALETTE,
//     onCancel: () => {},
//     onSave: (dataURL) => {
//       addMarkSprite(dataURL, gx, gy)
//       const marks = stateStore.marks || []
//       marks.push({ data: dataURL, gx, gy, at: Date.now() })
//       stateStore.marks = marks
//       LS.save(stateStore)
//       applyDecay()
//     }
//   })
// }






// import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js'
// import { openPixelEditor } from './editor.js'

// // -------- CONFIG --------
// const GRID_W = 32
// const GRID_H = 24
// const TILE = 1
// const SESSION_SECONDS = 120

// const PALETTE = ['#000000','#FFFFFF','#FF0000','#FF7F00','#FFFF00','#00FF00','#00FFFF','#0000FF','#8B00FF','#FFC0CB','#FFA500','#FFD700','#7FFF00','#40E0D0','#4169E1','#8A2BE2']

// // local persistence (no server)
// const LS = {
//   k:'pmark_state_v1',
//   load(){try{return JSON.parse(localStorage.getItem(this.k))||{}}catch{return{}}},
//   save(o){localStorage.setItem(this.k,JSON.stringify(o))}
// }
// const stateStore = LS.load()
// stateStore.visitors = (stateStore.visitors || 0)
// LS.save(stateStore)

// if(!sessionStorage.getItem('pm_session_started'))
//   sessionStorage.setItem('pm_session_started', Date.now().toString())

// // -------- DOM --------
// const mount = document.getElementById('mount')
// const btnPlace = document.getElementById('btnPlace')
// const timerEl  = document.getElementById('timer')
// const visitorsEl = document.getElementById('visitors')

// // -------- THREE SETUP --------
// const renderer = new THREE.WebGLRenderer({ antialias:false })
// mount.innerHTML = ''
// mount.appendChild(renderer.domElement)
// const scene = new THREE.Scene()
// scene.background = new THREE.Color(0x000000)

// const cam = new THREE.OrthographicCamera(
//   -(GRID_W*TILE)/2, (GRID_W*TILE)/2,
//   (GRID_H*TILE)/2, -(GRID_H*TILE)/2,
//   -100, 100
// )
// cam.position.set(0, 40, 0)
// cam.rotation.x = -Math.PI/2

// function resize(){
//   const w = mount.clientWidth
//   const h = mount.clientHeight
//   renderer.setSize(w, h, false)
// }
// resize()
// addEventListener('resize', resize)

// const loader = new THREE.TextureLoader()

// // Prairie ground (bounded)
// const prairie = loader.load('./assets/prairie1.jpg')
// prairie.wrapS = prairie.wrapT = THREE.RepeatWrapping
// prairie.repeat.set(2,2)
// prairie.magFilter = prairie.minFilter = THREE.NearestFilter
// prairie.colorSpace = THREE.SRGBColorSpace

// const ground = new THREE.Mesh(
//   new THREE.PlaneGeometry(GRID_W*TILE, GRID_H*TILE),
//   new THREE.MeshBasicMaterial({ map: prairie })
// )
// ground.rotation.x = -Math.PI/2
// scene.add(ground)

// // Optional play_area overlay (transparent PNG that hints walkable bounds)
// // If ./assets/play_area.png exists, it will draw on top; otherwise ignored.
// const playAreaTex = loader.load(
//   './assets/play_area.png',
//   () => { // onLoad
//     playAreaTex.magFilter = playAreaTex.minFilter = THREE.NearestFilter
//     playAreaTex.colorSpace = THREE.SRGBColorSpace
//   },
//   undefined,
//   () => {} // onError: ignore if missing
// )
// const playArea = new THREE.Mesh(
//   new THREE.PlaneGeometry(GRID_W*TILE, GRID_H*TILE),
//   new THREE.MeshBasicMaterial({ map: playAreaTex, transparent: true, opacity: 0.95 })
// )
// playArea.rotation.x = -Math.PI/2
// playArea.position.y = 0.105
// scene.add(playArea)

// // Decay (desaturate prairie as marks/visits grow)
// function computeDecay(){
//   const marks = (stateStore.marks || [])
//   const visitors = stateStore.visitors || 0
//   return Math.min(1,(marks.length + visitors) * 0.03)
// }
// function applyDecay(){
//   const dec = computeDecay()
//   ground.material.onBeforeCompile = (s) => {
//     s.fragmentShader = s.fragmentShader
//       .replace('#include <common>', `#include <common>
// vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);
// vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
// vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
// float d=q.x-min(q.w,q.y);float e=1e-10;
// return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
// vec3 hsv2rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.,1./3.,2./3.))*6.-3.);
// return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}`)
//       .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
//         `vec3 hsv = rgb2hsv(outgoingLight);
//          hsv.y *= (1.0 - ${dec.toFixed(3)} * 0.9);
//          gl_FragColor = vec4(hsv2rgb(hsv), diffuseColor.a);`)
//   }
//   ground.material.needsUpdate = true
// }
// applyDecay()

// // Player (red sprite)
// const playerTex = loader.load('./ui/player_red.PNG')
// playerTex.magFilter = playerTex.minFilter = THREE.NearestFilter
// playerTex.colorSpace = THREE.SRGBColorSpace
// const player = new THREE.Mesh(
//   new THREE.PlaneGeometry(1.5, 1.5),
//   new THREE.MeshBasicMaterial({ map: playerTex })
// )
// player.rotation.x = -Math.PI/2
// scene.add(player)

// // Marks (larger tiles)
// function addMarkSprite(dataURL, gx, gy){
//   const tex = new THREE.TextureLoader().load(dataURL)
//   tex.magFilter = tex.minFilter = THREE.NearestFilter
//   tex.colorSpace = THREE.SRGBColorSpace
//   const s = new THREE.Mesh(
//     new THREE.PlaneGeometry(2,2),
//     new THREE.MeshBasicMaterial({ map: tex, transparent: true })
//   )
//   s.rotation.x = -Math.PI/2
//   s.position.set((gx - GRID_W/2 + 0.5)*TILE, 0.11, (gy - GRID_H/2 + 0.5)*TILE)
//   scene.add(s)
// }
// ;(stateStore.marks || []).forEach(m => addMarkSprite(m.data, m.gx, m.gy))

// // Movement
// let target = { x: Math.floor(GRID_W/2), y: Math.floor(GRID_H/2) }
// function placePlayer(){
//   player.position.set(
//     (target.x - GRID_W/2 + 0.5)*TILE,
//     0.1,
//     (target.y - GRID_H/2 + 0.5)*TILE
//   )
//   cam.position.x = player.position.x
//   cam.position.z = player.position.z
//   cam.lookAt(player.position.x, 0, player.position.z)
// }
// placePlayer()

// function clampStep(dx,dy){
//   target.x = Math.max(0, Math.min(GRID_W-1, target.x + dx))
//   target.y = Math.max(0, Math.min(GRID_H-1, target.y + dy))
//   placePlayer()
// }

// // D-pad (click & hold auto-repeat)
// const repeat = (fn) => {
//   let id = 0
//   const start = () => { fn(); id = setInterval(fn, 120) }
//   const stop  = () => { clearInterval(id) }
//   return { start, stop }
// }
// const upR    = repeat(()=>clampStep(0,-1))
// const downR  = repeat(()=>clampStep(0, 1))
// const leftR  = repeat(()=>clampStep(-1,0))
// const rightR = repeat(()=>clampStep(1, 0))

// const bindHold = (el, rep) => {
//   el.addEventListener('mousedown', rep.start)
//   el.addEventListener('mouseup',   rep.stop)
//   el.addEventListener('mouseleave',rep.stop)
//   el.addEventListener('touchstart', (e)=>{ e.preventDefault(); rep.start() }, { passive:false })
//   el.addEventListener('touchend',   rep.stop)
//   el.addEventListener('touchcancel',rep.stop)
// }
// bindHold(document.querySelector('.dpad .up'), upR)
// bindHold(document.querySelector('.dpad .down'), downR)
// bindHold(document.querySelector('.dpad .left'), leftR)
// bindHold(document.querySelector('.dpad .right'), rightR)

// // Tap/Swipe on stage (mobile)
// let touchStart = null
// renderer.domElement.addEventListener('touchstart', (e)=>{
//   e.preventDefault()
//   const t = e.touches[0]
//   touchStart = { x: t.clientX, y: t.clientY, t: Date.now() }
// }, { passive:false })

// renderer.domElement.addEventListener('touchend', (e)=>{
//   if(!touchStart) return
//   const t = e.changedTouches[0]
//   const dx = t.clientX - touchStart.x
//   const dy = t.clientY - touchStart.y
//   const dt = Date.now() - touchStart.t
//   const THRESH = 22   // px
//   // swipe = step movement
//   if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > THRESH){
//     clampStep(dx>0?1:-1, 0)
//   } else if (Math.abs(dy) > THRESH){
//     clampStep(0, dy>0?1:-1)
//   } else if (dt < 220) {
//     // quick tap -> open editor at current tile
//     openEditorAt(target.x, target.y)
//   }
//   touchStart = null
// }, { passive:true })

// // Mouse click = open editor
// renderer.domElement.addEventListener('click', ()=>{
//   openEditorAt(target.x, target.y)
// })

// // Keyboard arrows (desktop)
// window.addEventListener('keydown', (e)=>{
//   if (e.key === 'ArrowUp')    clampStep(0,-1)
//   if (e.key === 'ArrowDown')  clampStep(0, 1)
//   if (e.key === 'ArrowLeft')  clampStep(-1,0)
//   if (e.key === 'ArrowRight') clampStep(1, 0)
// })

// // Place button
// btnPlace.onclick = () => openEditorAt(target.x, target.y)

// // Timer
// let timeLeft = SESSION_SECONDS
// timerEl.textContent = `${timeLeft}s`
// const tick = setInterval(()=>{
//   timeLeft = Math.max(0, timeLeft - 1)
//   timerEl.textContent = `${timeLeft}s`
//   if (timeLeft === 0){
//     clearInterval(tick)
//     stateStore.visitors = (stateStore.visitors || 0) + 1
//     LS.save(stateStore)
//     location.href = './kicked.html'
//   }
// }, 1000)
// visitorsEl.textContent = String(stateStore.visitors || 0)

// // Loop
// function animate(){ renderer.render(scene, cam); requestAnimationFrame(animate) }
// animate()

// // Editor open
// function openEditorAt(gx, gy){
//   openPixelEditor({
//     palette: PALETTE,
//     onCancel: () => {},
//     onSave: (dataURL) => {
//       addMarkSprite(dataURL, gx, gy)
//       const marks = stateStore.marks || []
//       marks.push({ data: dataURL, gx, gy, at: Date.now() })
//       stateStore.marks = marks
//       LS.save(stateStore)
//       applyDecay()
//     }
//   })
// }







// import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js'
// import { openPixelEditor } from './editor.js'

// // -------- CONFIG --------
// const GRID_W = 32
// const GRID_H = 24
// const TILE = 1
// const SESSION_SECONDS = 120

// const PALETTE = ['#000000','#FFFFFF','#FF0000','#FF7F00','#FFFF00','#00FF00','#00FFFF','#0000FF','#8B00FF','#FFC0CB','#FFA500','#FFD700','#7FFF00','#40E0D0','#4169E1','#8A2BE2']

// // local persistence (no server)
// const LS = { k:'pmark_state_v1', load(){try{return JSON.parse(localStorage.getItem(this.k))||{}}catch{return{}}}, save(o){localStorage.setItem(this.k,JSON.stringify(o))} }
// const stateStore = LS.load(); stateStore.visitors = (stateStore.visitors || 0); LS.save(stateStore)
// if(!sessionStorage.getItem('pm_session_started')) sessionStorage.setItem('pm_session_started', Date.now().toString())

// // -------- DOM --------
// const mount = document.getElementById('mount')
// const btnPlace = document.getElementById('btnPlace')
// const timerEl  = document.getElementById('timer')
// const visitorsEl = document.getElementById('visitors')

// // -------- THREE SETUP --------
// const renderer = new THREE.WebGLRenderer({ antialias:false })
// renderer.setPixelRatio(1) // chunkier pixels
// mount.innerHTML = ''
// mount.appendChild(renderer.domElement)
// const scene = new THREE.Scene()
// scene.background = new THREE.Color(0x000000)

// const cam = new THREE.OrthographicCamera(
//   -(GRID_W*TILE)/2, (GRID_W*TILE)/2,
//   (GRID_H*TILE)/2, -(GRID_H*TILE)/2,
//   -100, 100
// )
// cam.position.set(0, 40, 0)
// cam.rotation.x = -Math.PI/2

// function resize(){ const w = mount.clientWidth, h = mount.clientHeight; renderer.setSize(w, h, false) }
// resize(); addEventListener('resize', resize)

// const loader = new THREE.TextureLoader()

// // Prairie ground
// const prairie = loader.load('./assets/prairie1.jpg')
// prairie.wrapS = prairie.wrapT = THREE.RepeatWrapping
// prairie.repeat.set(2,2)
// prairie.magFilter = prairie.minFilter = THREE.NearestFilter
// prairie.colorSpace = THREE.SRGBColorSpace

// const ground = new THREE.Mesh(
//   new THREE.PlaneGeometry(GRID_W*TILE, GRID_H*TILE),
//   new THREE.MeshBasicMaterial({ map: prairie })
// )
// ground.rotation.x = -Math.PI/2
// scene.add(ground)

// // Play area overlay (optional)
// const playAreaTex = loader.load('./assets/play_area.png', () => {
//   playAreaTex.magFilter = playAreaTex.minFilter = THREE.NearestFilter
//   playAreaTex.colorSpace = THREE.SRGBColorSpace
// }, undefined, ()=>{})
// const playArea = new THREE.Mesh(
//   new THREE.PlaneGeometry(GRID_W*TILE, GRID_H*TILE),
//   new THREE.MeshBasicMaterial({ map: playAreaTex, transparent: true, opacity: 0.98 })
// )
// playArea.rotation.x = -Math.PI/2
// playArea.position.y = 0.105
// scene.add(playArea)

// // Soft grid (subtle)
// const grid = new THREE.GridHelper(GRID_W, GRID_W, 0x2a2f36, 0x1b1f25)
// grid.position.y = 0.051
// scene.add(grid)

// // Fence outline (map bounds)
// {
//   const geo = new THREE.BufferGeometry()
//   const x0 = -GRID_W/2, x1 = GRID_W/2, z0 = -GRID_H/2, z1 = GRID_H/2
//   const v = new Float32Array([
//     x0,0.11,z0,  x1,0.11,z0,
//     x1,0.11,z0,  x1,0.11,z1,
//     x1,0.11,z1,  x0,0.11,z1,
//     x0,0.11,z1,  x0,0.11,z0
//   ])
//   geo.setAttribute('position', new THREE.BufferAttribute(v, 3))
//   const mat = new THREE.LineBasicMaterial({ color: 0x6b7280 })
//   const fence = new THREE.LineSegments(geo, mat)
//   scene.add(fence)
// }

// // Vignette (subtle dark edges)
// {
//   const size = 256
//   const cvs = document.createElement('canvas'); cvs.width = cvs.height = size
//   const ctx = cvs.getContext('2d')
//   const g = ctx.createRadialGradient(size/2, size/2, size*0.2, size/2, size/2, size*0.65)
//   g.addColorStop(0, 'rgba(0,0,0,0)')
//   g.addColorStop(1, 'rgba(0,0,0,0.45)')
//   ctx.fillStyle = g; ctx.fillRect(0,0,size,size)
//   const tex = new THREE.CanvasTexture(cvs); tex.magFilter = tex.minFilter = THREE.LinearFilter
//   const quad = new THREE.Mesh(
//     new THREE.PlaneGeometry(GRID_W, GRID_H),
//     new THREE.MeshBasicMaterial({ map: tex, transparent: true })
//   )
//   quad.rotation.x = -Math.PI/2
//   quad.position.y = 0.12
//   scene.add(quad)
// }

// // Decay (desaturate prairie as marks/visits grow)
// function computeDecay(){ const marks=(stateStore.marks||[]), visitors=stateStore.visitors||0; return Math.min(1,(marks.length+visitors)*0.03) }
// function applyDecay(){
//   const dec = computeDecay()
//   ground.material.onBeforeCompile = (s) => {
//     s.fragmentShader = s.fragmentShader
//       .replace('#include <common>', `#include <common>
// vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);
// vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
// vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
// float d=q.x-min(q.w,q.y);float e=1e-10;
// return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
// vec3 hsv2rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.,1./3.,2./3.))*6.-3.);
// return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}`)
//       .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
//         `vec3 hsv = rgb2hsv(outgoingLight);
//          hsv.y *= (1.0 - ${dec.toFixed(3)} * 0.9);
//          gl_FragColor = vec4(hsv2rgb(hsv), diffuseColor.a);`)
//   }
//   ground.material.needsUpdate = true
// }
// applyDecay()

// // Player (red sprite)
// const playerTex = loader.load('./ui/player_red.PNG')
// playerTex.magFilter = playerTex.minFilter = THREE.NearestFilter
// playerTex.colorSpace = THREE.SRGBColorSpace
// const player = new THREE.Mesh(
//   new THREE.PlaneGeometry(1.5, 1.5),
//   new THREE.MeshBasicMaterial({ map: playerTex, transparent: true })
// )
// player.rotation.x = -Math.PI/2
// scene.add(player)

// // Marks (larger tiles)
// function addMarkSprite(dataURL, gx, gy){
//   const tex = new THREE.TextureLoader().load(dataURL)
//   tex.magFilter = tex.minFilter = THREE.NearestFilter
//   tex.colorSpace = THREE.SRGBColorSpace
//   const s = new THREE.Mesh(
//     new THREE.PlaneGeometry(2,2),
//     new THREE.MeshBasicMaterial({ map: tex, transparent: true })
//   )
//   s.rotation.x = -Math.PI/2
//   s.position.set((gx - GRID_W/2 + 0.5)*TILE, 0.11, (gy - GRID_H/2 + 0.5)*TILE)
//   scene.add(s)
// }
// ;(stateStore.marks || []).forEach(m => addMarkSprite(m.data, m.gx, m.gy))

// // Movement
// let target = { x: Math.floor(GRID_W/2), y: Math.floor(GRID_H/2) }
// function placePlayer(){
//   player.position.set((target.x - GRID_W/2 + 0.5)*TILE, 0.1, (target.y - GRID_H/2 + 0.5)*TILE)
//   cam.position.x = player.position.x; cam.position.z = player.position.z; cam.lookAt(player.position.x, 0, player.position.z)
// }
// placePlayer()
// function clampStep(dx,dy){ target.x=Math.max(0,Math.min(GRID_W-1,target.x+dx)); target.y=Math.max(0,Math.min(GRID_H-1,target.y+dy)); placePlayer() }

// // D-pad (hold-to-repeat)
// const repeat = (fn) => { let id=0; return { start(){fn(); id=setInterval(fn,120)}, stop(){clearInterval(id)} } }
// const bindHold = (el, rep) => {
//   el.addEventListener('mousedown', rep.start)
//   el.addEventListener('mouseup',   rep.stop)
//   el.addEventListener('mouseleave',rep.stop)
//   el.addEventListener('touchstart', (e)=>{ e.preventDefault(); rep.start() }, { passive:false })
//   el.addEventListener('touchend',   rep.stop)
//   el.addEventListener('touchcancel',rep.stop)
// }
// bindHold(document.querySelector('.dpad .up'),    repeat(()=>clampStep(0,-1)))
// bindHold(document.querySelector('.dpad .down'),  repeat(()=>clampStep(0, 1)))
// bindHold(document.querySelector('.dpad .left'),  repeat(()=>clampStep(-1,0)))
// bindHold(document.querySelector('.dpad .right'), repeat(()=>clampStep(1, 0)))

// // Tap/Swipe on stage
// let touchStart = null
// renderer.domElement.addEventListener('touchstart', (e)=>{
//   e.preventDefault()
//   const t = e.touches[0]
//   touchStart = { x: t.clientX, y: t.clientY, t: Date.now() }
// }, { passive:false })
// renderer.domElement.addEventListener('touchend', (e)=>{
//   if(!touchStart) return
//   const t = e.changedTouches[0], dx=t.clientX-touchStart.x, dy=t.clientY-touchStart.y, dt=Date.now()-touchStart.t
//   const THRESH = 22
//   if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > THRESH) clampStep(dx>0?1:-1, 0)
//   else if (Math.abs(dy) > THRESH) clampStep(0, dy>0?1:-1)
//   else if (dt < 220) openEditorAt(target.x, target.y)
//   touchStart = null
// }, { passive:true })

// // Mouse click = open editor
// renderer.domElement.addEventListener('click', ()=> openEditorAt(target.x, target.y))
// // Keyboard
// addEventListener('keydown', (e)=>{ if(e.key==='ArrowUp')clampStep(0,-1); if(e.key==='ArrowDown')clampStep(0,1); if(e.key==='ArrowLeft')clampStep(-1,0); if(e.key==='ArrowRight')clampStep(1,0) })

// // Place button
// btnPlace.onclick = () => openEditorAt(target.x, target.y)

// // Timer
// let timeLeft = SESSION_SECONDS
// timerEl.textContent = `${timeLeft}s`
// const tick = setInterval(()=>{
//   timeLeft = Math.max(0, timeLeft - 1)
//   timerEl.textContent = `${timeLeft}s`
//   if (timeLeft === 0){
//     clearInterval(tick)
//     stateStore.visitors = (stateStore.visitors || 0) + 1
//     LS.save(stateStore)
//     location.href = './kicked.html'
//   }
// }, 1000)
// visitorsEl.textContent = String(stateStore.visitors || 0)

// // Loop
// function animate(){ renderer.render(scene, cam); requestAnimationFrame(animate) }
// animate()

// // Editor
// function openEditorAt(gx, gy){
//   openPixelEditor({
//     palette: PALETTE,
//     onCancel: () => {},
//     onSave: (dataURL) => {
//       addMarkSprite(dataURL, gx, gy)
//       const marks = stateStore.marks || []
//       marks.push({ data: dataURL, gx, gy, at: Date.now() })
//       stateStore.marks = marks
//       LS.save(stateStore)
//       applyDecay()
//     }
//   })
// }




// import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js'
// import { openPixelEditor } from './editor.js'

// // --- CONFIG ---
// const GRID_W = 32
// const GRID_H = 24
// const TILE = 1
// const SESSION_SECONDS = 120
// const PALETTE = ['#000000','#FFFFFF','#FF0000','#FF7F00','#FFFF00','#00FF00','#00FFFF','#0000FF','#8B00FF','#FFC0CB','#FFA500','#FFD700','#7FFF00','#40E0D0','#4169E1','#8A2BE2']

// // Local state
// const LS = { k:'pmark_state_v1', load(){try{return JSON.parse(localStorage.getItem(this.k))||{}}catch{return{}}}, save(o){localStorage.setItem(this.k,JSON.stringify(o))} }
// const state = LS.load(); state.visitors=(state.visitors||0); LS.save(state)

// // --- SCENE ---
// const mount=document.getElementById('mount')
// const renderer=new THREE.WebGLRenderer({antialias:false})
// renderer.setSize(window.innerWidth,window.innerHeight)
// renderer.setPixelRatio(1)
// mount.appendChild(renderer.domElement)
// const scene=new THREE.Scene()
// scene.background=new THREE.Color(0x000000)

// // Camera closer for more immersion
// const cam=new THREE.OrthographicCamera(
//   -(GRID_W*TILE)/3, (GRID_W*TILE)/3,
//   (GRID_H*TILE)/3, -(GRID_H*TILE)/3,
//   -100,100
// )
// cam.position.set(0,20,0)
// cam.rotation.x=-Math.PI/2
// window.addEventListener('resize',()=>{
//   renderer.setSize(window.innerWidth,window.innerHeight)
// })

// // --- TEXTURES ---
// const loader=new THREE.TextureLoader()
// const prairie=loader.load('./assets/prairie1.jpg')
// prairie.wrapS=prairie.wrapT=THREE.RepeatWrapping
// prairie.repeat.set(2,2)
// prairie.magFilter=prairie.minFilter=THREE.NearestFilter

// const ground=new THREE.Mesh(
//   new THREE.PlaneGeometry(GRID_W*TILE,GRID_H*TILE),
//   new THREE.MeshBasicMaterial({map:prairie})
// )
// ground.rotation.x=-Math.PI/2
// scene.add(ground)

// // Play area overlay (stays fixed)
// const playAreaTex=loader.load('./assets/play_area.png',(t)=>{
//   t.magFilter=t.minFilter=THREE.NearestFilter
// })
// const playArea=new THREE.Mesh(
//   new THREE.PlaneGeometry(GRID_W*TILE,GRID_H*TILE),
//   new THREE.MeshBasicMaterial({map:playAreaTex,transparent:true,opacity:1})
// )
// playArea.rotation.x=-Math.PI/2
// playArea.position.y=0.11
// scene.add(playArea)

// // --- PLAYER ---
// const playerTex=loader.load('./ui/player_red.PNG')
// playerTex.magFilter=playerTex.minFilter=THREE.NearestFilter
// const player=new THREE.Mesh(
//   new THREE.PlaneGeometry(1.5,1.5),
//   new THREE.MeshBasicMaterial({map:playerTex,transparent:true})
// )
// player.rotation.x=-Math.PI/2
// player.position.y=0.15   // ensures above overlay
// player.renderOrder=5
// scene.add(player)

// // --- MARKS ---
// function addMarkSprite(dataURL,gx,gy){
//   const tex=new THREE.TextureLoader().load(dataURL)
//   tex.magFilter=tex.minFilter=THREE.NearestFilter
//   const s=new THREE.Mesh(
//     new THREE.PlaneGeometry(2,2),
//     new THREE.MeshBasicMaterial({map:tex,transparent:true})
//   )
//   s.rotation.x=-Math.PI/2
//   s.position.set((gx-GRID_W/2+0.5)*TILE,0.12,(gy-GRID_H/2+0.5)*TILE)
//   s.renderOrder=3
//   scene.add(s)
// }
// ;(state.marks||[]).forEach(m=>addMarkSprite(m.data,m.gx,m.gy))

// // --- MOVEMENT ---
// let pos={x:Math.floor(GRID_W/2),y:Math.floor(GRID_H/2)}
// function place(){
//   player.position.x=(pos.x-GRID_W/2+0.5)*TILE
//   player.position.z=(pos.y-GRID_H/2+0.5)*TILE
//   cam.position.x=player.position.x
//   cam.position.z=player.position.z
// }
// function step(dx,dy){
//   pos.x=Math.max(0,Math.min(GRID_W-1,pos.x+dx))
//   pos.y=Math.max(0,Math.min(GRID_H-1,pos.y+dy))
//   place()
// }
// place()

// // Keyboard
// window.addEventListener('keydown',e=>{
//   if(e.key==='ArrowUp')step(0,-1)
//   if(e.key==='ArrowDown')step(0,1)
//   if(e.key==='ArrowLeft')step(-1,0)
//   if(e.key==='ArrowRight')step(1,0)
//   if(e.key===' ') makeMark()
// })

// // Touch
// let touchStart=null
// renderer.domElement.addEventListener('touchstart',(e)=>{
//   const t=e.touches[0]; touchStart={x:t.clientX,y:t.clientY,t:Date.now()}
// },{passive:true})
// renderer.domElement.addEventListener('touchend',(e)=>{
//   if(!touchStart)return
//   const t=e.changedTouches[0]
//   const dx=t.clientX-touchStart.x, dy=t.clientY-touchStart.y
//   const TH=30
//   if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>TH)step(dx>0?1:-1,0)
//   else if(Math.abs(dy)>TH)step(0,dy>0?1:-1)
//   else makeMark()
//   touchStart=null
// })

// // --- TIMER ---
// let timeLeft=SESSION_SECONDS
// const tick=setInterval(()=>{
//   timeLeft=Math.max(0,timeLeft-1)
//   if(timeLeft===0){
//     clearInterval(tick)
//     state.visitors=(state.visitors||0)+1
//     LS.save(state)
//     location.href='./kicked.html'
//   }
//   updateHUD()
// },1000)

// // --- HUD IN 3D ---
// const hudCanvas=document.createElement('canvas')
// hudCanvas.width=256; hudCanvas.height=128
// const hudCtx=hudCanvas.getContext('2d')
// function drawHUD(){
//   hudCtx.clearRect(0,0,256,128)
//   hudCtx.fillStyle='rgba(0,0,0,0.6)'
//   hudCtx.fillRect(0,0,256,128)
//   hudCtx.fillStyle='#fff'
//   hudCtx.font='14px monospace'
//   hudCtx.fillText('pixel_mark',10,20)
//   hudCtx.fillText(`time: ${timeLeft}s`,10,45)
//   hudCtx.fillText(`visitors: ${state.visitors||0}`,10,70)
//   hudCtx.fillText('[★] place mark',10,100)
// }
// drawHUD()
// const hudTex=new THREE.CanvasTexture(hudCanvas)
// hudTex.needsUpdate=true
// const hudMat=new THREE.MeshBasicMaterial({map:hudTex,transparent:true})
// const hud=new THREE.Mesh(new THREE.PlaneGeometry(8,4),hudMat)
// hud.rotation.x=-Math.PI/2
// hud.position.set(-GRID_W/2+5,0.2,GRID_H/2-3)
// hud.renderOrder=10
// scene.add(hud)
// function updateHUD(){ drawHUD(); hudTex.needsUpdate=true }

// // --- EDITOR ---
// function makeMark(){
//   openPixelEditor({
//     palette:PALETTE,
//     onSave:(data)=>{
//       addMarkSprite(data,pos.x,pos.y)
//       const marks=state.marks||[]
//       marks.push({data,pos:pos.x,posY:pos.y,at:Date.now()})
//       state.marks=marks
//       LS.save(state)
//     },
//     onCancel:()=>{}
//   })
// }

// // --- LOOP ---
// function animate(){
//   renderer.render(scene,cam)
//   requestAnimationFrame(animate)
// }
// animate()



import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js'
import { openPixelEditor } from './editor.js'

// ---------- CONFIG ----------
const GRID_W = 64;            // your play field width (tiles)
const GRID_H = 32;            // your play field height (tiles)
const TILE   = 1;
const SESSION_SECONDS = 120;

const PALETTE = [
  '#000000','#FFFFFF','#FF0000','#FF7F00','#FFFF00','#00FF00','#00FFFF','#0000FF',
  '#8B00FF','#FFC0CB','#FFA500','#FFD700','#7FFF00','#40E0D0','#4169E1','#8A2BE2'
];

// localStorage persistence (no server)
const LS = {
  k: 'pmark_state_v1',
  load(){ try { return JSON.parse(localStorage.getItem(this.k)) || {} } catch { return {} } },
  save(o){ localStorage.setItem(this.k, JSON.stringify(o)) }
};
const stateStore = LS.load();
stateStore.visitors = (stateStore.visitors || 0);
LS.save(stateStore);

if(!sessionStorage.getItem('pm_session_started')){
  sessionStorage.setItem('pm_session_started', Date.now().toString());
}

// ---------- DOM ----------
const mount      = document.getElementById('mount');
const btnPlace   = document.getElementById('btnPlace');
const timerEl    = document.getElementById('timer');
const visitorsEl = document.getElementById('visitors');

// ---------- THREE BOOT ----------
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1); // crisp pixels
mount.innerHTML = '';
mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera: top-down, more zoomed-in and follows the player (so play_area feels big)
const cam = new THREE.OrthographicCamera(
  -(GRID_W*TILE)/6, (GRID_W*TILE)/6,   // narrower frustum => zoomed in
  (GRID_H*TILE)/6, -(GRID_H*TILE)/6,
  -100, 100
);
cam.position.set(0, 28, 0);
cam.rotation.x = -Math.PI/2;

function resize() {
  const w = mount.clientWidth;
  const h = mount.clientHeight;
  renderer.setSize(w, h, false);
}
resize();
addEventListener('resize', resize);

const loader = new THREE.TextureLoader();

// Ground: prairie texture
const prairie = loader.load('./assets/prairie1.jpg');
prairie.wrapS = prairie.wrapT = THREE.RepeatWrapping;
prairie.repeat.set(2, 2);
prairie.magFilter = prairie.minFilter = THREE.NearestFilter;
prairie.colorSpace = THREE.SRGBColorSpace;

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GRID_W*TILE, GRID_H*TILE),
  new THREE.MeshBasicMaterial({ map: prairie })
);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

// Optional: play_area overlay (if file present). This should sit ABOVE ground.
const playAreaTex = loader.load(
  './assets/play_area.png',
  (t) => {
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
  },
  undefined,
  () => { /* ignore if missing */ }
);
const playArea = new THREE.Mesh(
  new THREE.PlaneGeometry(GRID_W*TILE, GRID_H*TILE),
  new THREE.MeshBasicMaterial({ map: playAreaTex, transparent: true, opacity: 1 })
);
playArea.rotation.x = -Math.PI/2;
playArea.position.y = 0.11;   // overlay slightly above ground
playArea.renderOrder = 2;
scene.add(playArea);

// Subtle grid + fence (helps the “pixel map” feel)
const grid = new THREE.GridHelper(GRID_W, GRID_W, 0x2a2f36, 0x1b1f25);
grid.position.y = 0.051;
grid.renderOrder = 1;
scene.add(grid);

{ // fence outline (bounds)
  const geo = new THREE.BufferGeometry();
  const x0 = -GRID_W/2, x1 = GRID_W/2, z0 = -GRID_H/2, z1 = GRID_H/2;
  const v = new Float32Array([
    x0,0.12,z0,  x1,0.12,z0,
    x1,0.12,z0,  x1,0.12,z1,
    x1,0.12,z1,  x0,0.12,z1,
    x0,0.12,z1,  x0,0.12,z0
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x6b7280, linewidth: 1 });
  const fence = new THREE.LineSegments(geo, mat);
  fence.renderOrder = 3;
  scene.add(fence);
}

// Player sprite (ABOVE play_area)
const playerTex = loader.load('./ui/player_red.PNG');
playerTex.magFilter = playerTex.minFilter = THREE.NearestFilter;
playerTex.colorSpace = THREE.SRGBColorSpace;

const player = new THREE.Mesh(
  new THREE.PlaneGeometry(1.6, 1.6),
  new THREE.MeshBasicMaterial({ map: playerTex, transparent: true })
);
player.rotation.x = -Math.PI/2;
player.position.y = 0.20;   // higher than play_area and marks
player.renderOrder = 10;    // draw last (on top)
scene.add(player);

// Marks (2x2, ABOVE overlay but below player)
function addMarkSprite(dataURL, gx, gy){
  const tex = new THREE.TextureLoader().load(dataURL);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  s.rotation.x = -Math.PI/2;
  s.position.set((gx - GRID_W/2 + 0.5)*TILE, 0.15, (gy - GRID_H/2 + 0.5)*TILE);
  s.renderOrder = 5;  // above overlay, below player
  scene.add(s);
}
;(stateStore.marks || []).forEach(m => addMarkSprite(m.data, m.gx, m.gy));

// Decay (desaturate prairie as marks/visits grow)
function computeDecay(){
  const marks = (stateStore.marks || []);
  const visitors = stateStore.visitors || 0;
  return Math.min(1, (marks.length + visitors) * 0.03);
}
function applyDecay(){
  const dec = computeDecay();
  ground.material.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);
vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
float d=q.x-min(q.w,q.y);float e=1e-10;
return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
vec3 hsv2rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.,1./3.,2./3.))*6.-3.);
return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}`)
      .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
        `vec3 hsv = rgb2hsv(outgoingLight);
         hsv.y *= (1.0 - ${dec.toFixed(3)} * 0.9);
         gl_FragColor = vec4(hsv2rgb(hsv), diffuseColor.a);`);
  };
  ground.material.needsUpdate = true;
}
applyDecay();

// ---------- MOVEMENT ----------
let target = { x: Math.floor(GRID_W/2), y: Math.floor(GRID_H/2) };

function placePlayer(){
  player.position.x = (target.x - GRID_W/2 + 0.5)*TILE;
  player.position.z = (target.y - GRID_H/2 + 0.5)*TILE;

  // camera follows the player (so you feel zoomed in)
  cam.position.x = player.position.x;
  cam.position.z = player.position.z;
  cam.lookAt(player.position.x, 0, player.position.z);
}
placePlayer();

function clampStep(dx, dy){
  target.x = Math.max(0, Math.min(GRID_W-1, target.x + dx));
  target.y = Math.max(0, Math.min(GRID_H-1, target.y + dy));
  placePlayer();
}

// D-pad with hold-to-repeat
const repeat = (fn) => {
  let id = 0;
  return {
    start(){ fn(); id = setInterval(fn, 110); },
    stop(){ clearInterval(id); }
  };
};
function bindHold(sel, fn){
  const el = document.querySelector(sel);
  if(!el) return;
  const rep = repeat(fn);
  el.addEventListener('mousedown', rep.start);
  el.addEventListener('mouseup', rep.stop);
  el.addEventListener('mouseleave', rep.stop);
  el.addEventListener('touchstart', (e)=>{ e.preventDefault(); rep.start(); }, { passive:false });
  el.addEventListener('touchend', rep.stop);
  el.addEventListener('touchcancel', rep.stop);
}
bindHold('.dpad .up',    ()=>clampStep(0,-1));
bindHold('.dpad .down',  ()=>clampStep(0, 1));
bindHold('.dpad .left',  ()=>clampStep(-1,0));
bindHold('.dpad .right', ()=>clampStep(1, 0));

// Keyboard
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp')    clampStep(0,-1);
  if (e.key === 'ArrowDown')  clampStep(0, 1);
  if (e.key === 'ArrowLeft')  clampStep(-1,0);
  if (e.key === 'ArrowRight') clampStep(1, 0);
});

// Mouse/tap to place mark (click anywhere in stage)
renderer.domElement.addEventListener('click', () => openEditorAt(target.x, target.y));

// Button (star)
btnPlace.onclick = () => openEditorAt(target.x, target.y);

// ---------- TIMER ----------
let timeLeft = SESSION_SECONDS;
timerEl.textContent = `${timeLeft}s`;
const tick = setInterval(()=>{
  timeLeft = Math.max(0, timeLeft - 1);
  timerEl.textContent = `${timeLeft}s`;
  if (timeLeft === 0){
    clearInterval(tick);
    stateStore.visitors = (stateStore.visitors || 0) + 1;
    LS.save(stateStore);
    location.href = './kicked.html';
  }
}, 1000);
visitorsEl.textContent = String(stateStore.visitors || 0);

// ---------- LOOP ----------
function animate(){
  renderer.render(scene, cam);
  requestAnimationFrame(animate);
}
animate();

// ---------- EDITOR ----------
function openEditorAt(gx, gy){
  openPixelEditor({
    palette: PALETTE,
    onCancel: () => {},
    onSave: (dataURL) => {
      addMarkSprite(dataURL, gx, gy);
      const marks = stateStore.marks || [];
      marks.push({ data: dataURL, gx, gy, at: Date.now() });
      stateStore.marks = marks;
      LS.save(stateStore);
      applyDecay();
    }
  });
}
