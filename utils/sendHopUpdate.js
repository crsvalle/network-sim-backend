function simulatePacketConditions() {
    return {
      lost: Math.random() < 0.1,
      delay: Math.random() * 1000 + 300
    };
  }
  
  function sendHopUpdate({ socket, node, index, path, allEdges, initialNodeState, simulationId, colorId, maxRetries = 2, attempt = 1 }) {
    const { lost, delay } = simulatePacketConditions();
    const activePath = path.slice(0, index + 1);
  
    const updatedNodes = initialNodeState.map(n => ({
      ...n,
      color: activePath.includes(n.id)
        ? n.id === node
          ? lost ? '#9e9e9e' : '#f44336'
          : '#4caf50'
        : '#97C2FC',
    }));
  
    const updatedEdges = allEdges.map(e => ({
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
  
      if (lost && attempt < maxRetries) {
        sendHopUpdate({ socket, node, index, path, allEdges, initialNodeState, simulationId, colorId, attempt: attempt + 1 });
      }
    }, index * 1000 + delay);
  }
  
  module.exports = sendHopUpdate;
  