import type { ArchNodeData, ClusterNodeData, ViewModel } from '../derive/viewModel';

/**
 * Render the currently-visible view as a Mermaid flowchart. Node ids are aliased to
 * safe tokens (n0, n1, …) and labels are escaped so arbitrary symbol text can't break
 * Mermaid syntax (or inject markup downstream).
 */
export function toMermaid(vm: ViewModel): string {
  if (vm.nodes.length === 0) return 'flowchart LR\n  empty["(nothing to show)"]';

  const alias = new Map<string, string>();
  vm.nodes.forEach((n, i) => alias.set(n.id, `n${i}`));

  const lines = ['flowchart LR'];
  for (const n of vm.nodes) {
    const label =
      n.type === 'cluster'
        ? `${(n.data as ClusterNodeData).cluster.label} (${(n.data as ClusterNodeData).count})`
        : (n.data as ArchNodeData).node.label;
    const shape = n.type === 'cluster' ? ['(["', '"])'] : ['["', '"]'];
    lines.push(`  ${alias.get(n.id)}${shape[0]}${esc(label)}${shape[1]}`);
  }
  for (const e of vm.edges) {
    const a = alias.get(e.source);
    const b = alias.get(e.target);
    if (a && b) lines.push(`  ${a} --> ${b}`);
  }
  return lines.join('\n');
}

function esc(s: string): string {
  return s
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, '#quot;')
    .replace(/[[\]{}|<>]/g, '')
    .slice(0, 60);
}
