
function bellmanFord(graph, source) {
    const distances = {};
    const predecessors = {};
  
    for (let node in graph) {
      distances[node] = Infinity;
      predecessors[node] = null;
    }
    distances[source] = 0;
  
    const edges = [];
    for (let u in graph) {
      for (let v in graph[u]) {
        edges.push({ u, v, weight: graph[u][v] });
      }
    }
  
    const numNodes = Object.keys(graph).length;
  
    for (let i = 0; i < numNodes - 1; i++) {
      for (let { u, v, weight } of edges) {
        if (distances[u] + weight < distances[v]) {
          distances[v] = distances[u] + weight;
          predecessors[v] = u;
        }
      }
    }
  
    for (let { u, v, weight } of edges) {
      if (distances[u] + weight < distances[v]) {
        throw new Error("Graph contains a negative-weight cycle");
      }
    }
  
    return { distances, predecessors };
  }
  
  module.exports = { bellmanFord };
  