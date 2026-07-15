import React, { useMemo } from 'react';

// Renders min/max peak data as a filled waveform shape using SVG, so it
// scales cleanly to any pixel width via viewBox.
export default function Waveform({ peaks, color = '#e0a458', height = 56 }) {
  const path = useMemo(() => {
    if (!peaks || peaks.length === 0) return '';
    const numBuckets = peaks.length / 2;
    const mid = height / 2;
    const scale = mid * 0.95;

    let top = '';
    let bottom = '';
    for (let i = 0; i < numBuckets; i++) {
      const min = peaks[i * 2];
      const max = peaks[i * 2 + 1];
      const x = i;
      const yMax = mid - max * scale;
      const yMin = mid - min * scale;
      top += `${i === 0 ? 'M' : 'L'} ${x} ${yMax.toFixed(2)} `;
      bottom = `L ${x} ${yMin.toFixed(2)} ` + bottom;
    }
    return `${top} ${bottom} Z`;
  }, [peaks, height]);

  if (!peaks || peaks.length === 0) {
    return (
      <svg
        viewBox={`0 0 600 ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <line
          x1="0"
          y1={height / 2}
          x2="600"
          y2={height / 2}
          stroke={color}
          strokeOpacity="0.25"
          strokeWidth="1"
        />
      </svg>
    );
  }

  const numBuckets = peaks.length / 2;

  return (
    <svg
      viewBox={`0 0 ${numBuckets} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-full"
    >
      <path d={path} fill={color} fillOpacity="0.55" stroke={color} strokeWidth="0.75" />
    </svg>
  );
}
