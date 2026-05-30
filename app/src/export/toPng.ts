import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';

/**
 * Export a PNG screenshot of the current React Flow graph (EXPORT-05, optional).
 * Uses html-to-image pinned EXACTLY to 1.11.11 — later versions do not export images
 * correctly (bubkoo/html-to-image#516). Browser-only; triggers a download.
 */
export async function exportPng(nodes: Node[]): Promise<void> {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || nodes.length === 0) return;

  const width = 1280;
  const height = 880;
  const bounds = getNodesBounds(nodes);
  const vp = getViewportForBounds(bounds, width, height, 0.2, 2, 0.15);

  const dataUrl = await toPng(viewport, {
    backgroundColor: '#ffffff',
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
    },
  });

  const link = document.createElement('a');
  link.download = 'architecture.png';
  link.href = dataUrl;
  link.click();
}
