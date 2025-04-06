const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();
const { dijkstra } = require('./dijkstras')

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

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('sendMessage', (data) => {
    console.log(`Received message from ${data.from} to ${data.to}`);
  
    const graph = {
      '192.168.1.1': { '192.168.1.2': 1, '192.168.1.3': 4 },
      '192.168.1.2': { '192.168.1.3': 2, '192.168.1.4': 5 },
      '192.168.1.3': { '192.168.1.4': 1 },
      '192.168.1.4': {}
    };
  
    const { distances, previous } = dijkstra(graph, data.from);
  
    // Reconstruct shortest path
    let path = [];
    let currentNode = data.to;
    while (currentNode) {
      path.unshift(currentNode);
      currentNode = previous[currentNode];
    }
  
    const message = `Message from ${data.from} to ${data.to} will take the path: ${path.join(' -> ')}`;
  
    // Convert to vis-network format
    const nodes = Object.keys(graph).map((ip) => ({
      id: ip,
      label: ip,
      color: path.includes(ip) ? '#4caf50' : '#97C2FC',
    }));
  
    const edges = [];
    for (let [from, neighbors] of Object.entries(graph)) {
      for (let [to, weight] of Object.entries(neighbors)) {
        edges.push({
          from,
          to,
          label: weight.toString(),
          color: {
            color:
              path.includes(from) &&
              path.includes(to) &&
              path.indexOf(to) === path.indexOf(from) + 1
                ? '#4caf50'
                : '#848484',
          },
          arrows: 'to',
        });
      }
    }
  
    socket.emit('networkUpdate', { message, nodes, edges });
    socket.broadcast.emit('networkUpdate', { message, nodes, edges });
  });  
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
