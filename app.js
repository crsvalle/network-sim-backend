const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { dijkstra } = require('./dijkstras');

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

app.get('/', (req, res) => {
  res.send('Network Simulation Backend');
});

function simulatePacketConditions() {
  return {
    lost: Math.random() < 0.1,
    delay: Math.random() * 1500 + 500,
  };
}

function sendHopUpdate({ socket, node, index, path, allEdges, initialNodeState, maxRetries = 2, attempt = 1 }) {
  const { lost, delay } = simulatePacketConditions();
  const activePath = path.slice(0, index + 1);

  const updatedNodes = initialNodeState.map((n) => ({
    ...n,
    color: activePath.includes(n.id)
      ? n.id === node
        ? lost ? '#9e9e9e' : '#f44336'
        : '#4caf50'
      : '#97C2FC',
  }));

  const updatedEdges = allEdges.map((e) => ({
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

  const baseMsg = attempt > 1 ? ` (retry #${attempt})` : '';
  const message = lost
    ? `❌ Packet dropped at ${node}${baseMsg}`
    : index === 0
      ? `📤 Starting from ${node}${baseMsg}`
      : index === path.length - 1
        ? `✅ Arrived at ${node}${baseMsg}`
        : `➡️ Hopped to ${node}${baseMsg}`;

  console.log(`Sending update for node: ${node}, lost: ${lost}, delay: ${delay.toFixed(0)}ms, attempt: ${attempt}`);

  setTimeout(() => {
    socket.emit('networkUpdate', {
      message,
      nodes: updatedNodes,
      edges: updatedEdges,
    });

    if (lost && attempt < maxRetries) {
      sendHopUpdate({ socket, node, index, path, allEdges, initialNodeState, maxRetries, attempt: attempt + 1 });
    }
  }, index * 1500 + delay);
}

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('sendMessage', (data) => {
    console.log('Received sendMessage data:', data);

    const { from, to, graph } = data;

    if (!graph[from] || !graph[to]) {
      socket.emit('networkUpdate', { message: 'Invalid nodes. Path cannot be calculated.' });
      return;
    }

    const { distances, previous } = dijkstra(graph, from);

    let path = [];
    let currentNode = to;
    while (currentNode) {
      path.unshift(currentNode);
      currentNode = previous[currentNode];
    }

    if (distances[data.to] === Infinity) {
      socket.emit('networkUpdate', { message: 'No valid path found.' });
      return;
    }

    const initialNodeState = Object.keys(graph).map((ip) => ({
      id: ip,
      label: ip,
      color: '#97C2FC',
    }));

    const allEdges = [];
    for (let [from, neighbors] of Object.entries(graph)) {
      for (let [to, weight] of Object.entries(neighbors)) {
        allEdges.push({
          from,
          to,
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
        maxRetries: 2,
      });
    });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
