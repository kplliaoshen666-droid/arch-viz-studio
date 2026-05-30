import { memo, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { KIND_GLYPH } from './colors';
import type { ArchNodeData, ClusterNodeData } from '../derive/viewModel';

const HANDLE: CSSProperties = {
  width: 6,
  height: 6,
  background: '#cbcbd0',
  border: 'none',
};

/**
 * Member node. label / path / qualifiedName come from arbitrary repos — they are rendered
 * as React text children and a title attribute ONLY, which React escapes. We never use
 * dangerouslySetInnerHTML on code-derived strings (the XSS boundary, Pitfall 6).
 */
export const ArchNode = memo(function ArchNode({ data }: NodeProps) {
  const d = data as ArchNodeData;
  const n = d.node;
  return (
    <div className={`rf-node${d.selected ? ' sel' : ''}`} style={{ borderLeftColor: d.color }}>
      <Handle type="target" position={Position.Left} style={HANDLE} />
      <div className="nm" title={n.qualifiedName}>{n.label}</div>
      <div className="sub">
        <span className="mono" style={{ color: d.color, fontWeight: 700 }}>{KIND_GLYPH[n.kind]}</span>
        <span title={n.path}>{n.path}</span>
      </div>
      <Handle type="source" position={Position.Right} style={HANDLE} />
    </div>
  );
});

/** Collapsed-cluster super-node. */
export const ClusterNode = memo(function ClusterNode({ data }: NodeProps) {
  const d = data as ClusterNodeData;
  return (
    <div className="rf-node-cluster" style={{ borderColor: d.cluster.color }}>
      <Handle type="target" position={Position.Left} style={HANDLE} />
      <div className="cl">
        <span className="av-dot" style={{ background: d.cluster.color }} />
        {d.cluster.label}
      </div>
      <div className="ct">{d.count} nodes · click to expand</div>
      <Handle type="source" position={Position.Right} style={HANDLE} />
    </div>
  );
});

export const nodeTypes = { arch: ArchNode, cluster: ClusterNode };
