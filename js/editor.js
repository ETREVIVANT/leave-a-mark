export function openPixelEditor({ width=32, height=32, palette=[], onSave=()=>{}, onCancel=()=>{} }={}){
  const overlay = div('overlay')
  const wrap = div('editor-wrap')
  const frame = div('editor-frame') // pointer-events: none in CSS

  const cvs = document.createElement('canvas')
  cvs.width = width; cvs.height = height
  cvs.className = 'pixel-canvas'
  const ctx = cvs.getContext('2d', { willReadFrequently:true })
  ctx.clearRect(0,0,width,height) // keep alpha transparent

  const pal = div('palette')
  let color = palette[0] || '#ffffff'
  palette.forEach(c=>{
    const sw = button('swatch')
    sw.style.background = c
    sw.addEventListener('click', ()=> color = c)
    pal.appendChild(sw)
  })

  let painting = false
  const paintAt = (clientX, clientY)=>{
    const r = cvs.getBoundingClientRect()
    const x = Math.floor((clientX - r.left) / r.width  * width)
    const y = Math.floor((clientY - r.top)  / r.height * height)
    if (x<0||y<0||x>=width||y>=height) return
    ctx.fillStyle = color
    ctx.fillRect(x,y,1,1)
  }
  cvs.addEventListener('mousedown', e=>{ e.preventDefault(); painting=true; paintAt(e.clientX, e.clientY) })
  cvs.addEventListener('mousemove', e=>{ if(painting) paintAt(e.clientX, e.clientY) })
  addEventListener('mouseup', ()=> painting=false)

  cvs.addEventListener('touchstart', e=>{ e.preventDefault(); painting=true; const t=e.touches[0]; paintAt(t.clientX,t.clientY) }, { passive:false })
  cvs.addEventListener('touchmove',  e=>{ e.preventDefault(); if(painting){ const t=e.touches[0]; paintAt(t.clientX,t.clientY) } }, { passive:false })
  cvs.addEventListener('touchend',   ()=> painting=false)

  const actions = div('actions')
  const btnSave = img('./ui/save_btn.PNG','save','btn-img')
  const btnCancel = img('./ui/cancel_btn.PNG','cancel','btn-img')
  btnSave.addEventListener('click', ()=>{
    const url = cvs.toDataURL('image/png') // transparent PNG
    cleanup(); onSave(url)
  })
  btnCancel.addEventListener('click', ()=>{ cleanup(); onCancel() })
  actions.append(btnSave, btnCancel)

  const panel = div('panel')
  panel.append(cvs, pal, actions)

  wrap.append(frame, panel)
  overlay.append(wrap)
  overlay.addEventListener('click', (e)=>{ if (e.target === overlay) { cleanup(); onCancel() }})
  document.body.appendChild(overlay)

  function cleanup(){ overlay.remove() }
  function div(c){ const d=document.createElement('div'); if(c) d.className=c; return d }
  function button(c){ const b=document.createElement('button'); if(c) b.className=c; b.type='button'; b.style.border='0'; b.style.background='transparent'; return b }
  function img(src, alt, c){ const i=new Image(); i.src=src; i.alt=alt||''; if(c) i.className=c; return i }
}
