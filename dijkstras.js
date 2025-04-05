// Dijkstra's.js
const { MinPriorityQueue } = require('@datastructures-js/priority-queue');  

function dijkstra(graph, start) {
    const distances = {};
    const visited = new Set();
    const previous = {};
    const priorityQueue = new MinPriorityQueue();
  
    for (let node in graph) {
      distances[node] = Infinity;
      previous[node] = null;
    }
    distances[start] = 0;
    priorityQueue.enqueue(start, 0);
  
    while (!priorityQueue.isEmpty()) {
      const currentNode = priorityQueue.dequeue().element;
      if (visited.has(currentNode)) continue;
      visited.add(currentNode);
  
      const neighbors = graph[currentNode];
      for (let neighbor in neighbors) {
        const newDist = distances[currentNode] + neighbors[neighbor];
        if (newDist < distances[neighbor]) {
          distances[neighbor] = newDist;
          previous[neighbor] = currentNode;
          priorityQueue.enqueue(neighbor, distances[neighbor]);
        }
      }
    }
  
    return { distances, previous };
  }
  
  module.exports = { dijkstra };
  