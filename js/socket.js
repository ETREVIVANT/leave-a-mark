// // Point this to your public API domain (with HTTPS)
// export const SOCKET_BASE = "http://192.168.0.19:8080"; // e.g., https://api.etrevivant.xyz

// let socket;


// export function connectSocket({ onInit, onNewMark, onReset }) {
//   // io() comes from the CDN script
//   socket = window.io(SOCKET_BASE, {
//     transports: ["websocket"], // skip polling
//   });

//   socket.on("connect", () => {
//     // Connected
//   });

//   socket.on("state:init", (state) => {
//     // { visitors, marks, recentMarks: [{data,gx,gy,at}, ...] }
//     onInit?.(state);
//   });

//   socket.on("mark:new", ({ mark, stats }) => {
//     // { mark: {data,gx,gy,at}, stats: {visitors, marks} }
//     onNewMark?.(mark, stats);
//   });

//   socket.on("world:reset", () => {
//     onReset?.();
//   });

//   return socket;
// }

// export function saveMarkViaSocket({ data, gx, gy }) {
//   if (!socket) return;
//   socket.emit("mark:save", { data, gx, gy });
// }

// export function adminResetViaSocket(token) {
//   if (!socket) return;
//   socket.emit("admin:reset", token);
// }










// // Point to your Node/Socket.IO server when ready, else leave unused
// export const SOCKET_BASE = "http://192.168.0.19:8080"; // or https://api.yourdomain.com

// export function connectSocket({ onInit, onNewMark, onReset }){
//   if (!window.io) return null; // you must include <script src="https://cdn.socket.io/4.7.5/socket.io.min.js">
//   const socket = window.io(SOCKET_BASE, { transports:['websocket','polling'] });
//   socket.on('state:init', s => onInit?.(s));
//   socket.on('mark:new', ({ mark, stats }) => onNewMark?.(mark, stats));
//   socket.on('world:reset', () => onReset?.());
//   return socket;
// }

// export function saveMarkViaSocket({ data, gx, gy }){
//   if (!window.io || !SOCKET_BASE) return;
//   const s = window.io(SOCKET_BASE);
//   s.emit('mark:save', { data, gx, gy });
// }

// //********* latest above 