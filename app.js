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
    
    // Define the network graph (adjust as necessary)
    const graph = {
      'A': { 'B': 2, 'C': 4 },
      'B': { 'A': 2, 'C': 1, 'D': 7 },
      'C': { 'A': 4, 'B': 1, 'D': 3 },
      'D': { 'B': 7, 'C': 3 }
    };

    // Run Dijkstra to find the shortest path from 'from' to 'to'
    const { distances, previous } = dijkstra(graph, data.from);

    // Reconstruct the shortest path from 'from' to 'to'
    let path = [];
    let currentNode = data.to;
    while (currentNode) {
      path.unshift(currentNode);
      currentNode = previous[currentNode];
    }

    // Send the path to the frontend (along with the message)
    const message = `Message from ${data.from} to ${data.to} will take the path: ${path.join(' -> ')}`;
    socket.emit('networkUpdate', message);
    socket.broadcast.emit('networkUpdate', message);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
