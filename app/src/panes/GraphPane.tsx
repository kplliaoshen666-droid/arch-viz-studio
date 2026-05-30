import { useCallback, useEffect } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import { useStore, WARN_THRESHOLD } from '../state/store';
import type { ViewModel, ArchNodeData, ClusterNodeData } from '../derive/viewModel';
import { nodeTypes } from '../render/nodeTypes';
import { exportPng } from '../export/toPng';

function miniMapColor(n: Node): string {
  if (n.type === 'cluster') return (n.data as ClusterNodeData).cluster.color;
  return (n.data as ArchNodeData).color;
}

function GraphInner({ vm }: { vm: ViewModel }) {
  const select = useStore((s) => s.select);
  const toggleCluster = useStore((s) => s.toggleCluster);
  const selectedId = useStore((s) => s.selectedId);
  const rf = useReactFlow();

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_e, node) => {
      if (node.type === 'cluster') toggleCluster(Number(node.id.slice('cluster:'.length)));
      else select(node.id);
    },
    [select, toggleCluster],
  );

  // Re-center when the selection changes (VIEW-03). Runs after expansion adds the node.
  useEffect(() => {
    if (!selectedId) return;
    if (!rf.getNode(selectedId)) return;
    rf.fitView({ nodes: [{ id: selectedId }], duration: 400, maxZoom: 1.3, padding: 0.6 });
  }, [selectedId, rf, vm.nodes.length]);

  return (
    <ReactFlow
      nodes={vm.nodes}
      edges={vm.edges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={() => select(null)}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.08}
      maxZoom={2.2}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
    >
      <Panel position="top-right">
        <button className="av-btn av-btn-accent" onClick={() => void exportPng(vm.nodes)}>
          Export PNG
        </button>
      </Panel>
      <Background variant={BackgroundVariant.Dots} color="#e2e1de" gap={22} size={1} />
      <MiniMap pannable zoomable nodeColor={miniMapColor} nodeStrokeWidth={2} maskColor="rgba(246,246,244,0.7)" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function GraphPane({ vm }: { vm: ViewModel }) {
  const over = vm.visibleMemberCount > WARN_THRESHOLD;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {over && (
        <div className="av-banner">
          Showing {vm.visibleMemberCount} nodes — collapse clusters or filter to stay readable
        </div>
      )}
      <ReactFlowProvider>
        <GraphInner vm={vm} />
      </ReactFlowProvider>
    </div>
  );
}
