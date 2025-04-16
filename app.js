const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { dijkstra } = require('./dijkstras');
const sendHopUpdate = require('./utils/sendHopUpdate');
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

io.on('connection', (socket) => {
  console.log('🔌 User connected');

  socket.on('sendMessage', (data) => {
    const { from, to, graph, colorId } = data; 
    const simulationId = uuidv4();

    if (!graph[from] || !graph[to]) {
      socket.emit('networkUpdate', {
        message: '❗ Invalid nodes or graph structure.', 
        simulationId,
        colorId,
      });
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
      socket.emit('networkUpdate', {
        message: '❗ No path found.', 
        simulationId,
        colorId,
      });
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
        colorId, 
      });
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected');
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
