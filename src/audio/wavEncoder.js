// Encodes an AudioBuffer into a 16-bit PCM WAV Blob.
export function audioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  let offset = 0;
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString(view, offset, 'WAVE'); offset += 4;
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // PCM chunk size
  view.setUint16(offset, 1, true); offset += 2; // format = PCM
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4; // byte rate
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2; // bits per sample
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;

  // Interleave channels and write samples
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  let sampleIndex = 0;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(44 + sampleIndex * 2, intSample, true);
      sampleIndex++;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
