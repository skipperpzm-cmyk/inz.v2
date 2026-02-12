import React, { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  x: number;
  y: number;
}

export default function Tooltip({ text, x, y }: TooltipProps) {
  return createPortal(
    <span
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, 0)',
        zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        color: 'white',
        fontSize: '12px',
        borderRadius: '6px',
        padding: '4px 10px',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px 0 rgba(0,0,0,0.18)'
      }}
      role="tooltip"
      className="pointer-events-none"
    >
      {text}
    </span>,
    document.body
  );
}
