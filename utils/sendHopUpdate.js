function simulatePacketConditions() {
  const isLost = Math.random() < 0.1;
  const isQueueFull = !isLost && Math.random() < 0.05; 
  return {
    lost: isLost || isQueueFull,
    queueFull: isQueueFull,
    delay: Math.random() * 1000 + 300,
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
  maxRetries = 2,
  attempt = 1,
  disabledLinks = [],
}) {
  const { lost, queueFull, delay } = simulatePacketConditions();
  const activePath = path.slice(0, index + 1);

  const updatedNodes = initialNodeState.map(n => ({
    ...n,
    color: activePath.includes(n.id)
      ? n.id === node
        ? lost
          ? queueFull ? '#ff5722' : '#9e9e9e'
          : '#f44336'
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
    ? queueFull
      ? `🔥 Packet dropped at ${node} (Queue Full)`
      : `❌ Packet dropped at ${node}${attempt > 1 ? ` (retry #${attempt})` : ''}`
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
      dropReason: queueFull ? 'queueFull' : lost ? 'random' : null,  
    });

    if (lost && attempt < maxRetries) {
      sendHopUpdate({ socket, node, index, path, allEdges, initialNodeState, simulationId, colorId, attempt: attempt + 1 });
    }
  }, index * 1000 + delay);
}

module.exports = sendHopUpdate;
