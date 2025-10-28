// Set this to your own server that runs the Express+SQLite API.
// Examples:
//   const API_BASE = "https://api.yourdomain.com";
//   const API_BASE = "http://<your-server-ip>:8787";


const timerEl    = document.getElementById('timer');
const visitorsEl = document.getElementById('visitors');
const marksEl    = document.getElementById('marks');

const setCounts = ({ visitors, marks }) => {
  if (typeof visitors === 'number') visitorsEl.textContent = String(visitors);
  if (typeof marks === 'number')    marksEl.textContent    = String(marks);
};

// connectSocket({
//   onInit: ({ visitors, marks, recentMarks }) => {
//     setCounts({ visitors, marks });
//     (recentMarks || []).forEach(m => addMarkSprite(m.data, m.gx, m.gy));
//     applyDecay();
//   },
//   onNewMark: (mark, stats) => {
//     addMarkSprite(mark.data, mark.gx, mark.gy);
//     if (stats) setCounts(stats);
//     applyDecay();
//   },
//   onReset: () => {
//     // simplest: reload to clear local scene
//     location.reload();
//   }
// });

export const API_BASE = "https://api.yourdomain.com";

// --- tiny helpers ---
async function j(res){ if(!res.ok) throw new Error(`${res.status}`); return res.json(); }

export async function apiVisit(){
  return j(await fetch(`${API_BASE}/api/visit`, { method: 'POST' }));
}

export async function apiGetMarks(){
  return j(await fetch(`${API_BASE}/api/marks`));
}

export async function apiPostMark(mark){
  return j(await fetch(`${API_BASE}/api/marks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mark)
  }));
}

export async function apiStats(){
  return j(await fetch(`${API_BASE}/api/stats`));
}
