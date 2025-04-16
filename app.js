const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { dijkstra } = require('./dijkstras');
const { v4: uuidv4 } = require('uuid'); 

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  }
});

app.use(cors());

function simulatePacketConditions() {
  return {
    lost: Math.random() < 0.1,
    delay: Math.random() * 1000 + 300
  };
}

function sendHopUpdate({ socket, node, index, path, allEdges, initialNodeState, simulationId, maxRetries = 2, attempt = 1 }) {
  const { lost, delay } = simulatePacketConditions();
  const activePath = path.slice(0, index + 1);

  const updatedNodes = initialNodeState.map(n => ({
    ...n,
    color: activePath.includes(n.id)
      ? n.id === node
        ? lost ? '#9e9e9e' : '#f44336'
        : '#4caf50'
      : '#97C2FC',
  }));

  const updatedEdges = allEdges.map(e => ({
    ...e,
    color: {
      color:
        activePath.includes(e.from) &&
        activePath.includes(e.to) &&
        activePath.indexOf(e.to) === activePath.indexOf(e.from) + 1
          ? lost ? '#bdbdbd' : '#4caf50'
          : '#848484',
    },
  }));

  const message = lost
    ? `❌ Packet dropped at ${node}${attempt > 1 ? ` (retry #${attempt})` : ''}`
    : index === 0
      ? `📤 Starting from ${node}`
      : index === path.length - 1
        ? `✅ Arrived at ${node}`
        : `➡️ Hopped to ${node}`;

  setTimeout(() => {
    socket.emit('networkUpdate', {
      message,
      nodes: updatedNodes,
      edges: updatedEdges,
      path,           // include full path for frontend animation
      simulationId,   // for tracking animations
    });

    if (lost && attempt < maxRetries) {
      sendHopUpdate({ socket, node, index, path, allEdges, initialNodeState, simulationId, attempt: attempt + 1 });
    }
  }, index * 1000 + delay);
}

io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('sendMessage', (data) => {
    const { from, to, graph } = data;
    const simulationId = uuidv4();

    if (!graph[from] || !graph[to]) {
      socket.emit('networkUpdate', { message: '❗ Invalid nodes or graph structure.', simulationId });
      return;
    }

    const { distances, previous } = dijkstra(graph, from);

    let path = [];
    let currentNode = to;
    while (currentNode) {
      path.unshift(currentNode);
      currentNode = previous[currentNode];
    }

    if (distances[to] === Infinity) {
      socket.emit('networkUpdate', { message: '❗ No path found.', simulationId });
      return;
    }

    const initialNodeState = Object.keys(graph).map(ip => ({
      id: ip,
      label: ip,
      color: '#97C2FC',
    }));

    const allEdges = [];
    for (let [src, neighbors] of Object.entries(graph)) {
      for (let [dest, weight] of Object.entries(neighbors)) {
        allEdges.push({
          from: src,
          to: dest,
          label: weight.toString(),
          color: { color: '#848484' },
          arrows: 'to',
        });
      }
    }

    path.forEach((node, index) => {
      sendHopUpdate({
        socket,
        node,
        index,
        path,
        allEdges,
        initialNodeState,
        simulationId,
      });
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
