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
    lost: Math.random() < 0.1, // 10% chance to drop packet
    delay: Math.random() * 1500 + 500 // Delay between 500ms and 2000ms
  };
}

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('sendMessage', (data) => {
    console.log('Received sendMessage data:', data);

    const graph = {
      '192.168.1.1': { '192.168.1.2': 1, '192.168.1.3': 4 },
      '192.168.1.2': { '192.168.1.3': 2, '192.168.1.4': 5 },
      '192.168.1.3': { '192.168.1.4': 1 },
      '192.168.1.4': {}
    };

    if (!graph[data.from] || !graph[data.to]) {
      socket.emit('networkUpdate', { message: 'Invalid nodes. Path cannot be calculated.' });
      return;
    }

    const { distances, previous } = dijkstra(graph, data.from);

    let path = [];
    let currentNode = data.to;
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
      const { lost, delay } = simulatePacketConditions();
      setTimeout(() => {
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

        const message = lost
          ? `❌ Packet dropped at ${node}`
          : index === 0
            ? `📤 Starting from ${node}`
            : index === path.length - 1
              ? `✅ Arrived at ${node}`
              : `➡️ Hopped to ${node}`;

        console.log(`Sending update for node: ${node}, lost: ${lost}, delay: ${delay.toFixed(0)}ms`);

        socket.emit('networkUpdate', {
          message,
          nodes: updatedNodes,
          edges: updatedEdges,
        });
      }, index * 1500 + delay);
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
