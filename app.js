const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { dijkstra } = require('./dijkstras');
const sendHopUpdate = require('./utils/sendHopUpdate');
const { v4: uuidv4 } = require('uuid');
const { bellmanFord } = require('./bellmanFord');


const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  },
});

app.use(cors());

const switches = ['10.0.1.1', '10.0.2.1'];
const switchTables = {};
const switchQueues = {};
const MAX_QUEUE_SIZE = 5;
const edgeUtilization = {};


switches.forEach((sw) => {
  switchTables[sw] = {};
  switchQueues[sw] = [];
});

function incrementEdgeUtilization(from, to) {
  const key = `${from}->${to}`;
  if (!edgeUtilization[key]) edgeUtilization[key] = 0;
  edgeUtilization[key]++;
}

io.on('connection', (socket) => {
  console.log('🔌 User connected');

  socket.on('sendMessage', (data) => {
    const { from, to, graph, colorId, disabledLinks = [] } = data;
    const simulationId = uuidv4();
    const MAX_RETRIES = 2;
    const retryCount = data.retryCount || 0;

    function retryPacket(originalData, retryCount) {
      const newData = { ...originalData, retryCount: retryCount + 1 };
      setTimeout(() => {
        socket.emit('sendMessage', newData);
      }, 1000);
    }


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

    let distances, previous;
    if (data.algorithm === 'bellman-ford') {
      try {
        const result = bellmanFord(filteredGraph, from);
        distances = result.distances;
        previous = result.predecessors;
      } catch (err) {
        socket.emit('networkUpdate', {
          message: '❗ Bellman-Ford Error: ' + err.message,
          simulationId,
          colorId,
        });
        return;
      }
    } else {
      const result = dijkstra(filteredGraph, from);
      distances = result.distances;
      previous = result.previous;
    }

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
    const totalCost = path.reduce((sum, node, i) => {
      if (i === 0) return 0;
      return sum + graph[path[i - 1]][node];
    }, 0);

    socket.emit('simulationSummary', {
      simulationId,
      totalHops: path.length - 1,
      totalCost,
      retryCount: data.retryCount || 0,
      algorithm: data.algorithm || 'dijkstra',
    });


    // Switch logic + queueing
    for (let i = 1; i < path.length; i++) {
      const currentNode = path[i];
      const prevNode = path[i - 1];

      // Track link utilization
      incrementEdgeUtilization(prevNode, currentNode);

      // Emit live utilization update
      socket.emit('linkUtilizationUpdate', {
        from: prevNode,
        to: currentNode,
        usageCount: edgeUtilization[`${prevNode}->${currentNode}`],
      });

      if (switches.includes(currentNode)) {
        switchTables[currentNode][from] = prevNode;

        if (switchQueues[currentNode].length >= MAX_QUEUE_SIZE) {
          if (data.retryCount && data.retryCount >= MAX_RETRIES) {
            socket.emit('networkUpdate', {
              message: `❌ Packet dropped permanently at ${currentNode} after ${data.retryCount} retries`,
              nodes: [],
              edges: [],
              path: [],
              simulationId,
              colorId,
            });
          } else {
            socket.emit('networkUpdate', {
              message: `⚠️ Packet dropped at ${currentNode} — retrying (${(data.retryCount || 0) + 1}/${MAX_RETRIES})`,
              simulationId,
              colorId,
            });

            retryPacket(data, data.retryCount || 0);
          }
          return;
        }


        switchQueues[currentNode].push({ from, simulationId, colorId });

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
        disabledLinks,
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
