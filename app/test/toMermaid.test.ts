import { describe, it, expect } from 'vitest';
import type { GraphNode } from '@arch-viz/shared';
import { toMermaid } from '../src/render/toMermaid';
import type { ViewModel } from '../src/derive/viewModel';

function vmWithLabel(label: string): ViewModel {
  return {
    nodes: [
      {
        id: 'x',
        type: 'arch',
        position: { x: 0, y: 0 },
        data: { node: { label } as GraphNode, color: '#000', selected: false },
      },
    ],
    edges: [],
    visibleMemberCount: 1,
  };
}

describe('toMermaid', () => {
  it('emits a flowchart header', () => {
    expect(toMermaid(vmWithLabel('add')).startsWith('flowchart LR')).toBe(true);
  });

  it('escapes quotes and strips angle-bracket markup so labels cannot break out', () => {
    const out = toMermaid(vmWithLabel('evil"</script><b>'));
    expect(out).toContain('#quot;'); // quote escaped
    expect(out).not.toContain('</script>'); // angle markup stripped
    expect(out).not.toContain('<b>');
  });

  it('handles an empty view', () => {
    expect(toMermaid({ nodes: [], edges: [], visibleMemberCount: 0 })).toContain('flowchart LR');
  });
});
