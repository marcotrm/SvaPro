import React, { useRef, useState, useCallback, useEffect } from 'react';

const ROW_HEIGHT = 48;
const BUFFER = 5;

/**
 * Lightweight virtual-scroll table body.
 * Renders only visible rows inside a fixed-height scrollable container.
 *
 * Props:
 *   items       – full data array
 *   headers     – <thead> element
 *   renderRow   – (item, index) => <tr key=…>…</tr>
 *   emptyNode   – fallback when items is empty
 *   maxVisible  – max rows visible at once (default 12)
 *   rowHeight   – estimated row height in px (default 48)
 *   toolbar     – optional toolbar node rendered above the table inside the card
 */
export default function VirtualTable({
  items,
  headers,
  renderRow,
  emptyNode,
  maxVisible = 12,
  rowHeight = ROW_HEIGHT,
  toolbar,
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Reset scroll when items change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);

  if (!items.length) {
    return (
      <div className="table-card">
        {toolbar}
        <table>
          {headers}
          <tbody>{emptyNode}</tbody>
        </table>
      </div>
    );
  }

  const totalHeight = items.length * rowHeight;
  const viewportHeight = maxVisible * rowHeight;
  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER);
  const endIdx = Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + BUFFER);
  const paddingTop = startIdx * rowHeight;
  const paddingBottom = Math.max(0, (items.length - endIdx) * rowHeight);

  return (
    <div className="table-card">
      {toolbar}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ maxHeight: viewportHeight + 42 /* header */, overflowY: 'auto', overflowX: 'auto' }}
      >
        <table>
          {headers}
          <tbody>
            {paddingTop > 0 && (
              <tr aria-hidden="true"><td colSpan={999} style={{ height: paddingTop, padding: 0, border: 'none' }} /></tr>
            )}
            {items.slice(startIdx, endIdx).map((item, i) => renderRow(item, startIdx + i))}
            {paddingBottom > 0 && (
              <tr aria-hidden="true"><td colSpan={999} style={{ height: paddingBottom, padding: 0, border: 'none' }} /></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
