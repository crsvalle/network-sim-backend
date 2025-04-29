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

const switches = ['10.0.1.1', '10.0.2.1'];
const switchTables = {};
const switchQueues = {};
const MAX_QUEUE_SIZE = 5;
const PACKET_LOSS_PROBABILITY = 0.1; 
const MIN_DELAY = 300; 
const MAX_ADDITIONAL_DELAY = 1000; 
const MAX_RETRIES = 2;

switches.forEach((sw) => {
  switchTables[sw] = {};
  switchQueues[sw] = [];
});

function simulatePacketConditions() {
  return {
    lost: Math.random() < PACKET_LOSS_PROBABILITY,
    delay: Math.random() * MAX_ADDITIONAL_DELAY + MIN_DELAY,
  };
}


function sendHopUpdate({
  socket,
  node,
  index,
  path,
  allEdges,
  initialNodeState,
  simulationId,
  colorId,
  attempt = 1,
}) {
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
      path,
      simulationId,
      colorId,
    });

    if (lost && attempt <= MAX_RETRIES) {
      console.log(`🔄 Retrying packet at ${node} (attempt ${attempt})`);
      sendHopUpdate({
        socket,
        node,
        index,
        path,
        allEdges,
        initialNodeState,
        simulationId,
        colorId,
        attempt: attempt + 1,
      });
    }
  }, index * 1000 + delay);
}

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

    for (let i = 1; i < path.length; i++) {
      const currentNode = path[i];
      const prevNode = path[i - 1];

      if (switches.includes(currentNode)) {
        switchTables[currentNode][from] = prevNode;
        socket.emit('switchLearningUpdate', {
          switchId: currentNode,
          learnedTable: switchTables[currentNode],
        });


        if (switchQueues[currentNode].length >= MAX_QUEUE_SIZE) {
          console.log(`⚠️ Switch ${currentNode} queue full. Packet dropped.`);
          socket.emit('networkUpdate', {
            message: `❌ Packet dropped at ${currentNode} (Queue Full)`,
            nodes: [],
            edges: [],
            path: [],
            simulationId,
            colorId,
          });
          return; // Abort
        } else {
          switchQueues[currentNode].push({ from, simulationId, colorId });
          console.log(`➕ Queued at ${currentNode}: now ${switchQueues[currentNode].length} packets`);
        }
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
