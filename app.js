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

    // Check if from and to nodes exist in the graph
    if (!graph[data.from] || !graph[data.to]) {
      socket.emit('networkUpdate', { message: 'Invalid nodes. Path cannot be calculated.' });
      return;
    }

    // Run Dijkstra's algorithm to get distances and previous nodes
    const { distances, previous } = dijkstra(graph, data.from);

    // Reconstruct the path from the `from` node to `to` node
    let path = [];
    let currentNode = data.to;

    while (currentNode) {
      path.unshift(currentNode); // Add the current node to the beginning of the path
      currentNode = previous[currentNode]; // Move to the previous node
    }

    // If no path exists (previous is null)
    if (distances[data.to] === Infinity) {
      socket.emit('networkUpdate', { message: 'No valid path found.' });
      return;
    }


    // Prepare the initial node state
    const initialNodeState = Object.keys(graph).map((ip) => ({
      id: ip,
      label: ip,
      color: '#97C2FC',  
    }));

    // Prepare the edges from the graph
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

    // Update nodes and edges based on the reconstructed path
    path.forEach((node, index) => {
      setTimeout(() => {
        const activePath = path.slice(0, index + 1);

        // Update node colors
        const updatedNodes = initialNodeState.map((n) => ({
          ...n,
          color: activePath.includes(n.id)
            ? n.id === node
              ? '#f44336' // Red for current node
              : '#4caf50' // Green for visited nodes
            : '#97C2FC', // Default color
        }));

        // Update edge colors
        const updatedEdges = allEdges.map((e) => ({
          ...e,
          color: {
            color:
              activePath.includes(e.from) &&
              activePath.includes(e.to) &&
              activePath.indexOf(e.to) === activePath.indexOf(e.from) + 1
                ? '#4caf50'  // Green for active edges
                : '#848484', // Default edge color
          },
        }));

        // Determine the message based on the node index in the path
        const message = index === 0
          ? `Starting from ${node}`
          : index === path.length - 1
            ? `Arrived at ${node}`
            : `Hopped to ${node}`;


        // Emit the network update to the frontend
        socket.emit('networkUpdate', {
          message,
          nodes: updatedNodes,
          edges: updatedEdges,
        });
      }, index * 1500); 
    });
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
