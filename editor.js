
export function openPixelEditor({ onSave, onCancel, palette }) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="nine" style="width:560px;max-width:92vw;padding:16px;background:url(./ui/editor_bg.PNG) center/cover repeat;image-rendering:pixelated">
      <div style="position:relative;width:100%;display:grid;grid-template-columns:1fr 140px;gap:12px;align-items:start">
        <div style="display:grid;place-items:center;position:relative">
          <canvas id="pxCanvas" width="32" height="32"
            style="width:256px;height:256px;max-width:72vw;image-rendering:pixelated;background:#fff;border:1px solid #000;box-shadow:0 0 0 2px rgba(0,0,0,.3) inset"></canvas>
        </div>
        <div>
          <div style="font-size:12px;margin-bottom:6px"></div>
          <div id="pal" style="display:grid;grid-template-columns:repeat(4, 28px);gap:6"></div>
          <div style="font-size:12px;margin-top:10px;color:#cbd5e1"></div>
        </div>
      </div>
      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:12px">
        <button id="btnCancel" class="btn"><img class="pixel ui16h" src="./ui/cancel_btn.PNG" alt="Cancel"></button>
        <button id="btnSave" class="btn"><img class="pixel ui16h" src="./ui/save_btn.PNG" alt="Save"></button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector('#pxCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;

  // old fill
  ctx.fillStyle = ctx.clearRect(0, 0, 32, 32); // make background transparent
  
  //'#FFFFFF'; ctx.fillRect(0, 0, 32, 32);

  // Palette
  let current = '#000000';
  const pal = overlay.querySelector('#pal');
  (palette || ['#000','#fff']).forEach(c => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.title = c;
    b.innerHTML = `<div style="width:24px;height:24px;border:1px solid #000;background:${c}"></div>`;
    b.onclick = () => (current = c);
    pal.appendChild(b);
  });

  // Draw (mouse + touch)
  let drawing = false;
  const toLocal = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - r.left) / r.width) * 32);
    const y = Math.floor(((clientY - r.top) / r.height) * 32);
    return { x: Math.max(0, Math.min(31, x)), y: Math.max(0, Math.min(31, y)) };
  };
  const dot = (x, y) => { ctx.fillStyle = current; ctx.fillRect(x, y, 1, 1); };

  // mouse
  const mdown = e => { drawing = true; const p = toLocal(e.clientX, e.clientY); dot(p.x, p.y); };
  const mmove = e => { if(!drawing) return; const p = toLocal(e.clientX, e.clientY); dot(p.x, p.y); };
  const mup   = () => { drawing = false; };
  canvas.addEventListener('mousedown', mdown);
  canvas.addEventListener('mousemove', mmove);
  window.addEventListener('mouseup', mup);

  // touch
  const tstart = e => {
    e.preventDefault();
    if (e.touches.length === 2) current = '#FFFFFF';
    const t = e.touches[0]; drawing = true;
    const p = toLocal(t.clientX, t.clientY); dot(p.x, p.y);
  };
  const tmove = e => { e.preventDefault(); if(!drawing) return; const t = e.touches[0]; const p = toLocal(t.clientX, t.clientY); dot(p.x, p.y); };
  const tend  = () => { drawing = false; };
  canvas.addEventListener('touchstart', tstart, { passive:false });
  canvas.addEventListener('touchmove',  tmove,  { passive:false });
  canvas.addEventListener('touchend',   tend);
  canvas.addEventListener('touchcancel',tend);

  // right-click erase
  // canvas.addEventListener('contextmenu', e => { e.preventDefault(); current = '#FFFFFF'; });

  // buttons
  overlay.querySelector('#btnCancel').onclick = () => { cleanup(); onCancel && onCancel(); };
  overlay.querySelector('#btnSave').onclick = () => {
    const dataURL = canvas.toDataURL('image/png');
    cleanup(); onSave && onSave(dataURL);
  };

  function cleanup(){
    canvas.removeEventListener('mousedown', mdown);
    canvas.removeEventListener('mousemove', mmove);
    window.removeEventListener('mouseup', mup);
    canvas.removeEventListener('touchstart', tstart);
    canvas.removeEventListener('touchmove',  tmove);
    canvas.removeEventListener('touchend',   tend);
    canvas.removeEventListener('touchcancel',tend);
    document.body.removeChild(overlay);
  }
}
