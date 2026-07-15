import lamejs from 'lamejs';

// Converts a Float32Array (range -1..1) into Int16Array PCM samples.
function floatTo16BitPCM(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

// Encodes an AudioBuffer into an MP3 Blob using lamejs.
// kbps controls the output bitrate (default 192kbps for good vocal quality).
export function audioBufferToMp3(audioBuffer, kbps = 192) {
  const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps);

  const left = floatTo16BitPCM(audioBuffer.getChannelData(0));
  const right =
    numChannels === 2
      ? floatTo16BitPCM(audioBuffer.getChannelData(1))
      : null;

  const blockSize = 1152; // multiple required by lamejs
  const mp3Chunks = [];

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    let mp3buf;
    if (numChannels === 2) {
      const rightChunk = right.subarray(i, i + blockSize);
      mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = encoder.encodeBuffer(leftChunk);
    }
    if (mp3buf.length > 0) {
      mp3Chunks.push(new Int8Array(mp3buf));
    }
  }

  const finalBuf = encoder.flush();
  if (finalBuf.length > 0) {
    mp3Chunks.push(new Int8Array(finalBuf));
  }

  return new Blob(mp3Chunks, { type: 'audio/mp3' });
}
