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


const switches = ['10.0.1.1', '10.0.2.1'];
const switchTables = {};
switches.forEach((sw) => {
  switchTables[sw] = {}; 
});

io.on('connection', (socket) => {
  console.log('🔌 User connected');

  socket.on('sendMessage', (data) => {
    const { from, to, graph, colorId, disabledLinks = [] } = data; 
    const simulationId = uuidv4();
  
    if (!graph[from] || !graph[to]) {
      socket.emit('networkUpdate', {
        message: '❗ Invalid nodes or graph structure.', 
        simulationId,
        colorId,
      });
      return;
    }
  
    // Filter out disabled links
    const filteredGraph = {};
    for (let [src, neighbors] of Object.entries(graph)) {
      filteredGraph[src] = {};
      for (let [dest, weight] of Object.entries(neighbors)) {
        const isDisabled = disabledLinks.some(
          (link) => link.from === src && link.to === dest
        );
        if (!isDisabled) {
          filteredGraph[src][dest] = weight;
        }
      }
    }
  
    // Use filtered graph for Dijkstra
    const { distances, previous } = dijkstra(filteredGraph, from);
    let path = [];
    let currentNode = to;
    while (currentNode) {
      path.unshift(currentNode);
      currentNode = previous[currentNode];
    }
  
    if (distances[to] === Infinity) {
      socket.emit('networkUpdate', {
        message: '❗ No path found due to link failure.', 
        simulationId,
        colorId,
      });
      return;
    }
  
    for (let i = 1; i < path.length; i++) {
      const currentNode = path[i];
      const prevNode = path[i - 1];
      if (switches.includes(currentNode)) {
        switchTables[currentNode][from] = prevNode;
        console.log(`🔍 Switch ${currentNode} learned ${from} is via ${prevNode}`);
  
        socket.emit('switchLearningUpdate', {
          switchId: currentNode,
          learnedTable: switchTables[currentNode],
        });
      }
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
