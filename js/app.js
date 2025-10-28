// ---------- OPTIONAL IMPORTS FOR SERVER MODE (safe for static GitHub Pages) ----------
let connectSocket = null, saveMarkViaSocket = null
let apiVisit = null, apiGetMarks = null, apiPostMark = null, apiStats = null


try {
  const s = await import('./socket.js')
  connectSocket = s.connectSocket
  saveMarkViaSocket = s.saveMarkViaSocket
} catch {}
try {
  const a = await import('./api.js')
  apiVisit = a.apiVisit
  apiGetMarks = a.apiGetMarks
  apiPostMark = a.apiPostMark
  apiStats = a.apiStats
} catch {}

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js'
import { openPixelEditor } from './editor.js'

/* ======================= CONFIG ======================= */
const GRID_W = 64, GRID_H = 32, TILE = 1
const SESSION_SECONDS = 1000
const RESET_WORLD = false
const SHOW_GRID_AND_FENCE = true
const CAMERA_DIVISOR_DEFAULT = 5       // normal zoom
const CAMERA_DIVISOR_FULL = 1.5        // full map toggle
const CAMERA_HEIGHT = 42

const PALETTE = [
  '#000000','#FFFFFF','#FF0000','#FF7F00','#FFFF00','#00FF00','#00FFFF',
  '#0000FF','#8B00FF','#FFC0CB','#FFA500','#FFD700','#7FFF00','#40E0D0','#4169E1','#8A2BE2'
]

/* ======================= LOCAL STORAGE STATE ======================= */
const LS = {
  k:'pmark_state_v1',
  load(){ try { return JSON.parse(localStorage.getItem(this.k))||{} } catch { return {} } },
  save(o){ localStorage.setItem(this.k, JSON.stringify(o)) },
  clear(){ localStorage.removeItem(this.k) }
}
if (RESET_WORLD) { LS.clear(); console.warn('World reset (marks cleared).') }

const state = LS.load()
state.visitors ??= 0
state.marks ??= []
LS.save(state)

/* ======================= DOM ELEMENTS ======================= */
const mount      = document.getElementById('mount')
const btnPlace   = document.getElementById('btnPlace')
const timerEl    = document.getElementById('timer')
const visitorsEl = document.getElementById('visitors')
const marksEl    = document.getElementById('marks')

// --- create the zoom button (bottom-right corner) dynamically ---
const zoomBtn = document.createElement('button')
zoomBtn.textContent = 'Full map'
zoomBtn.style.cssText = `
  position:absolute;right:12px;bottom:12px;z-index:65;
  background:#000a;color:#fff;border:1px solid #ffffff22;
  border-radius:12px;padding:10px 14px;font-size:14px;
  backdrop-filter:blur(2px);
`
mount.appendChild(zoomBtn)

// prevent page from scrolling on touch
document.addEventListener('touchmove', (e)=>{ e.preventDefault() }, { passive:false })

/* ======================= THREE.JS SCENE ======================= */
const renderer = new THREE.WebGLRenderer({ antialias:false, alpha:false })
renderer.setPixelRatio(1)
renderer.setSize(mount.clientWidth, mount.clientHeight, false)
mount.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)

const worldW = GRID_W * TILE
const worldH = GRID_H * TILE

// camera setup
const cam = new THREE.OrthographicCamera(-1,1,1,-1, -100, 100)
cam.position.set(0, CAMERA_HEIGHT, 0)
cam.rotation.x = -Math.PI/2
let cameraDivisor = CAMERA_DIVISOR_DEFAULT

function setCameraFrustum(divisor){
  cameraDivisor = divisor
  cam.left   = -(GRID_W*TILE)/divisor
  cam.right  =  (GRID_W*TILE)/divisor
  cam.top    =  (GRID_H*TILE)/divisor
  cam.bottom = -(GRID_H*TILE)/divisor
  cam.updateProjectionMatrix()
}
setCameraFrustum(CAMERA_DIVISOR_DEFAULT)

/* ======================= RESIZE HANDLER ======================= */
function resize(){
  renderer.setSize(mount.clientWidth, mount.clientHeight, false)
  cam.updateProjectionMatrix()
  clampCameraToWorld()
}
addEventListener('resize', resize)

/* ======================= TEXTURES ======================= */
const loader = new THREE.TextureLoader()

// base plane (background)
const prairie = loader.load('./assets/play_area.PNG')
prairie.wrapS = prairie.wrapT = THREE.RepeatWrapping
prairie.repeat.set(2,2)
prairie.magFilter = prairie.minFilter = THREE.NearestFilter
prairie.colorSpace = THREE.SRGBColorSpace

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GRID_W*TILE, GRID_H*TILE),
  new THREE.MeshBasicMaterial({ map: prairie })
)
ground.rotation.x = -Math.PI/2
ground.position.y = 0.0
ground.renderOrder = 0
scene.add(ground)

/* ======= PLAY AREA MASK =======
   Used to block movement outside visible PNG bounds.
   The alpha channel defines “walkable” area.
*/
let playArea = null
let walkMask = null


function buildWalkMaskFromTexture(tex){
  const img = tex.image
  const cw = img.width, ch = img.height
  const c = document.createElement('canvas')
  c.width = cw; c.height = ch
  const ctx = c.getContext('2d', { willReadFrequently:true })
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0,0,cw,ch).data
  walkMask = Array.from({length: GRID_H}, ()=> Array(GRID_W).fill(false))

  // check alpha values per grid cell
  for (let gy=0; gy<GRID_H; gy++){
    for (let gx=0; gx<GRID_W; gx++){
      const px = Math.floor((gx + 0.5) / GRID_W * cw)
      const py = Math.floor((gy + 0.5) / GRID_H * ch)
      const idx = (py * cw + px) * 4
      const alpha = data[idx+3]
      walkMask[gy][gx] = alpha > 10  // opaque enough to walk on
    }
  }
}

loader.load('./assets/play_area.png', (t)=>{
  t.magFilter = t.minFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  playArea = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID_W*TILE, GRID_H*TILE),
    new THREE.MeshBasicMaterial({ map: t, transparent:true, opacity:1 })
  )
  playArea.rotation.x = -Math.PI/2
  playArea.position.y = 0.11
  playArea.renderOrder = 2
  scene.add(playArea)

  // build mask for collision (invisible wall)
  buildWalkMaskFromTexture(t)
})

/* ======= OPTIONAL GRID AND FENCE ======= */
if (SHOW_GRID_AND_FENCE) {
  const grid = new THREE.GridHelper(GRID_W, GRID_W, 0x2a2f36, 0x1b1f25)
  grid.position.y = 0.051
  grid.renderOrder = 1
  scene.add(grid)

  const geo = new THREE.BufferGeometry()
  const x0=-GRID_W/2, x1=GRID_W/2, z0=-GRID_H/2, z1=GRID_H/2
  const v = new Float32Array([
    x0,0.12,z0, x1,0.12,z0,
    x1,0.12,z0, x1,0.12,z1,
    x1,0.12,z1, x0,0.12,z1,
    x0,0.12,z1, x0,0.12,z0
  ])
  geo.setAttribute('position', new THREE.BufferAttribute(v,3))
  const mat = new THREE.LineBasicMaterial({ color:0x6b7280 })
  const fence = new THREE.LineSegments(geo, mat)
  fence.renderOrder = 3
  scene.add(fence)
}

/* ======================= PLAYER ======================= */
const playerTex = loader.load('./ui/player_red.PNG')
playerTex.magFilter = playerTex.minFilter = THREE.NearestFilter
playerTex.colorSpace = THREE.SRGBColorSpace
const player = new THREE.Mesh(
  new THREE.PlaneGeometry(1.6,1.6),
  new THREE.MeshBasicMaterial({ map: playerTex, transparent:true })
)
player.rotation.x = -Math.PI/2
player.position.y = 0.20
player.renderOrder = 10
scene.add(player)

/* ======================= MARKS ======================= */
function addMarkSprite(dataURL, gx, gy){
  const tex = new THREE.TextureLoader().load(dataURL)
  tex.magFilter = tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2,2),
    new THREE.MeshBasicMaterial({ map: tex, transparent:true })
  )
  m.rotation.x = -Math.PI/2
  m.position.set((gx - GRID_W/2 + 0.5)*TILE, 0.15, (gy - GRID_H/2 + 0.5)*TILE)
  m.renderOrder = 5
  scene.add(m)
}
state.marks.forEach(m => addMarkSprite(m.data, m.gx, m.gy))
if (marksEl) marksEl.textContent = String(state.marks.length)

/* ======================= DECAY ======================= */
function computeDecay(){ return Math.min(1,(state.marks.length + (state.visitors||0)) * 0.03) }
function applyDecay(){
  const dec = computeDecay()
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
         gl_FragColor = vec4(hsv2rgb(hsv), diffuseColor.a);`)
  }
  ground.material.needsUpdate = true
}
applyDecay()

/* ======================= MOVEMENT & COLLISION ======================= */
let target = { x: Math.floor(GRID_W/2), y: Math.floor(GRID_H/2) }

function clampCameraToWorld(){
  const halfW = (GRID_W*TILE)/cameraDivisor
  const halfH = (GRID_H*TILE)/cameraDivisor
  cam.position.x = THREE.MathUtils.clamp(cam.position.x, -worldW/2 + halfW, worldW/2 - halfW)
  cam.position.z = THREE.MathUtils.clamp(cam.position.z, -worldH/2 + halfH, worldH/2 - halfH)
  cam.lookAt(cam.position.x, 0, cam.position.z)
}

function place(){
  player.position.x = (target.x - GRID_W/2 + 0.5)*TILE
  player.position.z = (target.y - GRID_H/2 + 0.5)*TILE
  cam.position.x = player.position.x
  cam.position.z = player.position.z
  clampCameraToWorld()
}

// movement constrained to alpha mask
function clampStep(dx, dy){
  let nx = target.x + dx
  let ny = target.y + dy
  nx = Math.max(0, Math.min(GRID_W-1, nx))
  ny = Math.max(0, Math.min(GRID_H-1, ny))
  // if play area mask exists, block moves outside opaque zone
  if (walkMask && !walkMask[ny]?.[nx]) return
  target.x = nx
  target.y = ny
  place()
}
place()

/* ===== D-PAD & KEYBOARD INPUT ===== */
function holdRepeat(fn){ let id=0; return { start(){ fn(); id=setInterval(fn,110) }, stop(){ clearInterval(id) } } }
function bindHold(sel, fn){
  const el = document.querySelector(sel); if(!el) return
  const rep = holdRepeat(fn)
  el.addEventListener('mousedown', rep.start)
  el.addEventListener('mouseup', rep.stop)
  el.addEventListener('mouseleave', rep.stop)
  el.addEventListener('touchstart', e=>{ e.preventDefault(); rep.start() }, { passive:false })
  el.addEventListener('touchend', rep.stop)
  el.addEventListener('touchcancel', rep.stop)
}
bindHold('.dpad .up',    ()=>clampStep(0,-1))
bindHold('.dpad .down',  ()=>clampStep(0, 1))
bindHold('.dpad .left',  ()=>clampStep(-1,0))
bindHold('.dpad .right', ()=>clampStep(1, 0))
addEventListener('keydown', (e)=>{
  if(e.key==='ArrowUp')clampStep(0,-1)
  if(e.key==='ArrowDown')clampStep(0, 1)
  if(e.key==='ArrowLeft')clampStep(-1,0)
  if(e.key==='ArrowRight')clampStep(1,0)
})

/* ===== ZOOM TOGGLE ===== */
zoomBtn.addEventListener('click', ()=>{
  const full = cameraDivisor !== CAMERA_DIVISOR_FULL
  setCameraFrustum(full ? CAMERA_DIVISOR_FULL : CAMERA_DIVISOR_DEFAULT)
  zoomBtn.textContent = full ? 'Normal view' : 'Full map'
  cam.position.x = player.position.x
  cam.position.z = player.position.z
  clampCameraToWorld()
})

/* ===== CLICK/TAP TO OPEN EDITOR ===== */
renderer.domElement.addEventListener('click', ()=> openEditorAt(target.x, target.y))
btnPlace?.addEventListener('click', ()=> openEditorAt(target.x, target.y))

/* ======================= TIMER ======================= */
let timeLeft = SESSION_SECONDS
if (timerEl) timerEl.textContent = `${timeLeft}s`
if (visitorsEl) visitorsEl.textContent = String(state.visitors || 0)
const tick = setInterval(()=>{
  timeLeft = Math.max(0, timeLeft - 1)
  if (timerEl) timerEl.textContent = `${timeLeft}s`
  if (timeLeft === 0){
    clearInterval(tick)
    state.visitors++
    LS.save(state)
  }
}, 1000)

/* ======================= RENDER LOOP ======================= */
function animate(){ renderer.render(scene, cam); requestAnimationFrame(animate) }
animate()

/* ======================= PIXEL EDITOR HOOK ======================= */
function openEditorAt(gx, gy){
  document.body.classList.add('editor-open')
  openPixelEditor({
    width: 32, height: 32,
    palette: PALETTE,
    onCancel: () => { document.body.classList.remove('editor-open') },
    onSave: async (dataURL) => {
      addMarkSprite(dataURL, gx, gy)
      state.marks.push({ data:dataURL, gx, gy, at:Date.now() })
      LS.save(state)
      if (marksEl) marksEl.textContent = String(state.marks.length)
      applyDecay()
      if (saveMarkViaSocket) { try { saveMarkViaSocket({ gx, gy, data:dataURL }) } catch {} }
      if (apiPostMark)       { try { await apiPostMark({ gx, gy, data:dataURL }) } catch {} }
      document.body.classList.remove('editor-open')
    }
  })
}

/* ======================= OPTIONAL SERVER INIT ======================= */
;(async ()=>{
  if (apiVisit)  { try { await apiVisit() } catch {} }
  if (apiStats && visitorsEl) {
    try {
      const s = await apiStats()
      if (typeof s?.visitors === 'number') visitorsEl.textContent = String(s.visitors)
    } catch {}
  }
  if (apiGetMarks) {
    try {
      const remoteMarks = await apiGetMarks()
      if (Array.isArray(remoteMarks)) remoteMarks.forEach(m => addMarkSprite(m.data, m.gx, m.gy))
    } catch {}
  }
  if (connectSocket) {
    try {
      const sock = connectSocket()
      sock.on('mark:new', ({ gx, gy, data }) => addMarkSprite(data, gx, gy))
    } catch {}
  }
})()





// //v1 - wokring below 
// // optional real-time + api (won't crash if the files aren't present on static hosting)
// let connectSocket = null, saveMarkViaSocket = null
// let apiVisit = null, apiGetMarks = null, apiPostMark = null, apiStats = null
// try {
//   // eslint-disable-next-line import/no-unresolved
//   const s = await import('./socket.js')
//   connectSocket = s.connectSocket
//   saveMarkViaSocket = s.saveMarkViaSocket
// } catch {}
// try {
//   // eslint-disable-next-line import/no-unresolved
//   const a = await import('./api.js')
//   apiVisit = a.apiVisit
//   apiGetMarks = a.apiGetMarks
//   apiPostMark = a.apiPostMark
//   apiStats = a.apiStats
// } catch {}

// import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js'
// import { openPixelEditor } from './editor.js'

// /* ===== CONFIG ===== */
// const GRID_W = 64, GRID_H = 32, TILE = 1
// const SESSION_SECONDS = 720
// const RESET_WORLD = false       // set true once to clear local world
// const SHOW_GRID_AND_FENCE = true
// const CAMERA_DIVISOR = 5       // lower number => zooms OUT; + add a button to zoom out see full map

// const CAMERA_HEIGHT = 42       // raise to look “higher” top-down

// const PALETTE = [
//   '#000000','#FFFFFF','#FF0000','#FF7F00','#FFFF00','#00FF00','#00FFFF',
//   '#0000FF','#8B00FF','#FFC0CB','#FFA500','#FFD700','#7FFF00','#40E0D0','#4169E1','#8A2BE2'
// ]

// /* ===== PERSISTENCE (local only) ===== */
// const LS = {
//   k:'pmark_state_v1',
//   load(){ try { return JSON.parse(localStorage.getItem(this.k))||{} } catch { return {} } },
//   save(o){ localStorage.setItem(this.k, JSON.stringify(o)) },
//   clear(){ localStorage.removeItem(this.k) }
// }
// if (RESET_WORLD) { LS.clear(); console.warn('world reset (local marks cleared)') }

// const state = LS.load()
// state.visitors ??= 0
// state.marks ??= []
// LS.save(state)

// /* ===== DOM ===== */
// const mount      = document.getElementById('mount')
// const btnPlace   = document.getElementById('btnPlace')
// const timerEl    = document.getElementById('timer')
// const visitorsEl = document.getElementById('visitors')
// const marksEl    = document.getElementById('marks')

// // stop page scrolling during game interactions
// document.addEventListener('touchmove', (e)=>{ e.preventDefault() }, { passive:false })

// /* ===== THREE ===== */
// const renderer = new THREE.WebGLRenderer({ antialias:false, alpha:false })
// renderer.setPixelRatio(1) // crisp
// renderer.setSize(mount.clientWidth, mount.clientHeight, false)
// mount.appendChild(renderer.domElement)

// const scene = new THREE.Scene()
// scene.background = new THREE.Color(0x000000)

// const worldW = GRID_W * TILE
// const worldH = GRID_H * TILE

// // less zoomed-in: widen frustum with CAMERA_DIVISOR; then a small zoom tweak
// const cam = new THREE.OrthographicCamera(
//   -(GRID_W*TILE)/CAMERA_DIVISOR, (GRID_W*TILE)/CAMERA_DIVISOR,
//    (GRID_H*TILE)/CAMERA_DIVISOR, -(GRID_H*TILE)/CAMERA_DIVISOR,
//   -100, 100
// )
// cam.position.set(0, CAMERA_HEIGHT, 0)
// cam.rotation.x = -Math.PI/2
// cam.zoom = 0.95
// cam.updateProjectionMatrix()

// function resize(){
//   renderer.setSize(mount.clientWidth, mount.clientHeight, false)
//   // keep zoom/frustum stable on resize
//   cam.updateProjectionMatrix()
// }
// addEventListener('resize', resize)

// /* ===== TEXTURES ===== */
// const loader = new THREE.TextureLoader()

// // base plane (fallback if overlay missing) — uses the same image to be safe
// const prairie = loader.load('./assets/play_area.PNG', undefined, undefined, ()=>{})
// prairie.wrapS = prairie.wrapT = THREE.RepeatWrapping
// prairie.repeat.set(2,2)
// prairie.magFilter = prairie.minFilter = THREE.NearestFilter
// prairie.colorSpace = THREE.SRGBColorSpace

// const ground = new THREE.Mesh(
//   new THREE.PlaneGeometry(GRID_W*TILE, GRID_H*TILE),
//   new THREE.MeshBasicMaterial({ map: prairie })
// )
// ground.rotation.x = -Math.PI/2
// ground.position.y = 0.0
// ground.renderOrder = 0
// scene.add(ground)

// // overlay that defines the true play area (PNG with alpha)
// let playArea = null
// loader.load('./assets/play_area.png', (t)=>{
//   t.magFilter = t.minFilter = THREE.NearestFilter
//   t.colorSpace = THREE.SRGBColorSpace
//   playArea = new THREE.Mesh(
//     new THREE.PlaneGeometry(GRID_W*TILE, GRID_H*TILE),
//     new THREE.MeshBasicMaterial({ map: t, transparent:true, opacity:1 })
//   )
//   playArea.rotation.x = -Math.PI/2
//   playArea.position.y = 0.11
//   playArea.renderOrder = 2
//   scene.add(playArea)
// })

// // optional grid & fence lines to sell the space
// if (SHOW_GRID_AND_FENCE) {
//   const grid = new THREE.GridHelper(GRID_W, GRID_W, 0x2a2f36, 0x1b1f25)
//   grid.position.y = 0.051
//   grid.renderOrder = 1
//   scene.add(grid)

//   const geo = new THREE.BufferGeometry()
//   const x0=-GRID_W/2, x1=GRID_W/2, z0=-GRID_H/2, z1=GRID_H/2
//   const v = new Float32Array([
//     x0,0.12,z0, x1,0.12,z0,
//     x1,0.12,z0, x1,0.12,z1,
//     x1,0.12,z1, x0,0.12,z1,
//     x0,0.12,z1, x0,0.12,z0
//   ])
//   geo.setAttribute('position', new THREE.BufferAttribute(v,3))
//   const mat = new THREE.LineBasicMaterial({ color:0x6b7280 })
//   const fence = new THREE.LineSegments(geo, mat)
//   fence.renderOrder = 3
//   scene.add(fence)
// }

// /* ===== PLAYER ===== */
// const playerTex = loader.load('./ui/player_red.PNG')
// playerTex.magFilter = playerTex.minFilter = THREE.NearestFilter
// playerTex.colorSpace = THREE.SRGBColorSpace
// const player = new THREE.Mesh(
//   new THREE.PlaneGeometry(1.6,1.6),
//   new THREE.MeshBasicMaterial({ map: playerTex, transparent:true })
// )
// player.rotation.x = -Math.PI/2
// player.position.y = 0.20
// player.renderOrder = 10
// scene.add(player)

// /* ===== MARKS ===== */
// function addMarkSprite(dataURL, gx, gy){
//   const tex = new THREE.TextureLoader().load(dataURL)
//   tex.magFilter = tex.minFilter = THREE.NearestFilter
//   tex.colorSpace = THREE.SRGBColorSpace
//   const m = new THREE.Mesh(
//     new THREE.PlaneGeometry(2,2),
//     new THREE.MeshBasicMaterial({ map: tex, transparent:true })
//   )
//   m.rotation.x = -Math.PI/2
//   m.position.set((gx - GRID_W/2 + 0.5)*TILE, 0.15, (gy - GRID_H/2 + 0.5)*TILE)
//   m.renderOrder = 5
//   scene.add(m)
// }
// state.marks.forEach(m => addMarkSprite(m.data, m.gx, m.gy))
// if (document.getElementById('marks')) document.getElementById('marks').textContent = String(state.marks.length)

// /* ===== DECAY (desaturate base as use grows) ===== */
// function computeDecay(){ return Math.min(1,(state.marks.length + (state.visitors||0)) * 0.03) }
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

// /* ===== MOVEMENT ===== */
// let target = { x: Math.floor(GRID_W/2), y: Math.floor(GRID_H/2) }
// function place(){

//   // player.position.x = (target.x - GRID_W/2 + 0.5) * TILE
//   // player.position.z = (target.y - GRID_H/2 + 0.5) * TILE
//   // cam.position.x = THREE.MathUtils.clamp(player.position.x, -worldW/2, worldW/2)
//   // cam.position.z = THREE.MathUtils.clamp(player.position.z, -worldH/2, worldH/2)

//   player.position.x = (target.x - GRID_W/2 + 0.5)*TILE
//   player.position.z = (target.y - GRID_H/2 + 0.5)*TILE
//   cam.position.x = player.position.x
//   cam.position.z = player.position.z
//   cam.lookAt(player.position.x, 0, player.position.z)
// }
// function clampStep(dx,dy){

//   target.x = Math.max(-1, Math.min(GRID_W, target.x + dx))
//   target.y = Math.max(-1, Math.min(GRID_H, target.y + dy))
//   // target.x = Math.max(0, Math.min(GRID_W-1, target.x + dx))
//   // target.y = Math.max(0, Math.min(GRID_H-1, target.y + dy))
//   place()
// }
// place()

// // D-pad with hold repeat + preventDefault (mobile safe)
// function holdRepeat(fn){
//   let id=0
//   return { start(){ fn(); id=setInterval(fn,110) }, stop(){ clearInterval(id) } }
// }
// function bindHold(sel, fn){
//   const el = document.querySelector(sel); if(!el) return
//   const rep = holdRepeat(fn)
//   el.addEventListener('mousedown', rep.start)
//   el.addEventListener('mouseup', rep.stop)
//   el.addEventListener('mouseleave', rep.stop)
//   el.addEventListener('touchstart', e=>{ e.preventDefault(); rep.start() }, { passive:false })
//   el.addEventListener('touchend', rep.stop)
//   el.addEventListener('touchcancel', rep.stop)
// }
// bindHold('.dpad .up',    ()=>clampStep(0,-1))
// bindHold('.dpad .down',  ()=>clampStep(0, 1))
// bindHold('.dpad .left',  ()=>clampStep(-1,0))
// bindHold('.dpad .right', ()=>clampStep(1, 0))

// addEventListener('keydown', (e)=>{
//   if(e.key==='ArrowUp')clampStep(0,-1)
//   if(e.key==='ArrowDown')clampStep(0, 1)
//   if(e.key==='ArrowLeft')clampStep(-1,0)
//   if(e.key==='ArrowRight')clampStep(1,0)
// })

// /* ===== CLICK/TAP TO OPEN EDITOR ===== */
// renderer.domElement.addEventListener('click', ()=> openEditorAt(target.x, target.y))
// btnPlace?.addEventListener('click', ()=> openEditorAt(target.x, target.y))

// /* ===== TIMER ===== */
// let timeLeft = SESSION_SECONDS
// if (timerEl) timerEl.textContent = `${timeLeft}s`
// if (visitorsEl) visitorsEl.textContent = String(state.visitors || 0)
// const tick = setInterval(()=>{
//   timeLeft = Math.max(0, timeLeft - 1)
//   if (timerEl) timerEl.textContent = `${timeLeft}s`
//   if (timeLeft === 0){
//     clearInterval(tick)
//     state.visitors = (state.visitors || 0) + 1
//     LS.save(state)
//     // optionally redirect: location.href = './kicked.html'
//   }
// }, 1000)

// /* ===== LOOP ===== */
// function animate(){ renderer.render(scene, cam); requestAnimationFrame(animate) }
// animate()

// /* ===== EDITOR HOOK ===== */
// function openEditorAt(gx, gy){
//   document.body.classList.add('editor-open')
//   openPixelEditor({
//     width: 32, height: 32,           // consistent internal pixel grid
//     palette: PALETTE,
//     onCancel: () => { document.body.classList.remove('editor-open') },
//     onSave: async (dataURL) => {
//       addMarkSprite(dataURL, gx, gy)
//       state.marks.push({ data:dataURL, gx, gy, at:Date.now() })
//       LS.save(state)
//       if (marksEl) marksEl.textContent = String(state.marks.length)
//       applyDecay()

//       //broadcast/save if server exists
//       if (saveMarkViaSocket) { try { saveMarkViaSocket({ gx, gy, data:dataURL }) } catch {} }
//       if (apiPostMark)       { try { await apiPostMark({ gx, gy, data:dataURL }) } catch {} }

//       document.body.classList.remove('editor-open')
//     }
//   })
// }

// /* ===== BOOTSTRAP (server) ===== */
// ;(async ()=>{
//   if (apiVisit)  { try { await apiVisit() } catch {} }
//   if (apiStats && visitorsEl) {
//     try {
//       const s = await apiStats()
//       if (typeof s?.visitors === 'number') visitorsEl.textContent = String(s.visitors)
//     } catch {}
//   }
//   if (apiGetMarks) {
//     try {
//       const remoteMarks = await apiGetMarks()
//       if (Array.isArray(remoteMarks)) {
//         remoteMarks.forEach(m => addMarkSprite(m.data, m.gx, m.gy))
//       }
//     } catch {}
//   }
//   if (connectSocket) {
//     try {
//       const sock = connectSocket()
//       sock.on('mark:new', ({ gx, gy, data }) => addMarkSprite(data, gx, gy))
//     } catch {}
//   }
// })()

//good version works ^^



