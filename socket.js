// Point this to your public API domain (with HTTPS)
export const SOCKET_BASE = "https://api.yourdomain.com"; // e.g., https://api.etrevivant.xyz

let socket;


export function connectSocket({ onInit, onNewMark, onReset }) {
  // io() comes from the CDN script
  socket = window.io(SOCKET_BASE, {
    transports: ["websocket"], // skip polling
  });

  socket.on("connect", () => {
    // Connected
  });

  socket.on("state:init", (state) => {
    // { visitors, marks, recentMarks: [{data,gx,gy,at}, ...] }
    onInit?.(state);
  });

  socket.on("mark:new", ({ mark, stats }) => {
    // { mark: {data,gx,gy,at}, stats: {visitors, marks} }
    onNewMark?.(mark, stats);
  });

  socket.on("world:reset", () => {
    onReset?.();
  });

  return socket;
}

export function saveMarkViaSocket({ data, gx, gy }) {
  if (!socket) return;
  socket.emit("mark:save", { data, gx, gy });
}

export function adminResetViaSocket(token) {
  if (!socket) return;
  socket.emit("admin:reset", token);
}
