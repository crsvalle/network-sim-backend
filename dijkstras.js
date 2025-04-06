function dijkstra(graph, start) {
  const distances = {};
  const previous = {};
  const nodes = new Set();

  // Initialize nodes, distances, and previous
  for (let node in graph) {
    if (node === start) {
      distances[node] = 0;
    } else {
      distances[node] = Infinity;
    }
    previous[node] = null;
    nodes.add(node);
  }

  while (nodes.size) {
    // Get the node with the smallest distance
    let closestNode = null;
    nodes.forEach((node) => {
      if (closestNode === null || distances[node] < distances[closestNode]) {
        closestNode = node;
      }
    });

    if (distances[closestNode] === Infinity) {
      break; // If there are no more reachable nodes, exit the loop
    }

    nodes.delete(closestNode);

    // Update the neighbors' distances
    for (let neighbor in graph[closestNode]) {
      const distance = graph[closestNode][neighbor];
      const alt = distances[closestNode] + distance;

      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = closestNode;
      }
    }
  }

  return { distances, previous };
}

module.exports = { dijkstra };
