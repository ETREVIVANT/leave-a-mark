// Set this to your own server that runs the Express+SQLite API.
// Examples:
//   const API_BASE = "https://api.yourdomain.com";
//   const API_BASE = "http://<your-server-ip>:8787";
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
