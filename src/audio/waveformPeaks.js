// Downsamples an AudioBuffer into min/max peak pairs for waveform drawing.
// Returns a Float32Array of length numBuckets * 2: [min0, max0, min1, max1, ...]
export function computePeaks(audioBuffer, numBuckets) {
  const channelData = audioBuffer.getChannelData(0);
  const total = channelData.length;
  const bucketSize = Math.max(1, Math.floor(total / numBuckets));
  const peaks = new Float32Array(numBuckets * 2);

  for (let i = 0; i < numBuckets; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, total);
    let min = 0;
    let max = 0;
    for (let j = start; j < end; j++) {
      const v = channelData[j];
      if (v > max) max = v;
      if (v < min) min = v;
    }
    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }

  return peaks;
}
