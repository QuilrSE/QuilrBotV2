// ============================================================================
// AWS event-stream decoder (application/vnd.amazon.eventstream)
//
// Bedrock's ConverseStream doesn't use Server-Sent Events; it frames each
// event in a small binary envelope:
//
//   ┌──────────────┬───────────────┬─────────────┬─────────┬─────────┬─────────────┐
//   │ total len u32│ headers len u32│ prelude crc │ headers │ payload │ message crc │
//   └──────────────┴───────────────┴─────────────┴─────────┴─────────┴─────────────┘
//
// Frames can arrive split across (or merged within) network chunks, so the
// decoder buffers bytes and only yields complete, CRC-checked messages.
// ============================================================================

export interface EventStreamMessage {
  headers: Record<string, string | number | boolean>;
  payload: Uint8Array;
}

const PRELUDE_LENGTH = 12;
const MIN_MESSAGE_LENGTH = 16;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const textDecoder = new TextDecoder();

function decodeHeaders(bytes: Uint8Array): Record<string, string | number | boolean> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headers: Record<string, string | number | boolean> = {};
  let offset = 0;

  while (offset < bytes.length) {
    const nameLength = view.getUint8(offset);
    offset += 1;
    const name = textDecoder.decode(bytes.subarray(offset, offset + nameLength));
    offset += nameLength;
    const type = view.getUint8(offset);
    offset += 1;

    switch (type) {
      case 0:
        headers[name] = true;
        break;
      case 1:
        headers[name] = false;
        break;
      case 2:
        headers[name] = view.getInt8(offset);
        offset += 1;
        break;
      case 3:
        headers[name] = view.getInt16(offset);
        offset += 2;
        break;
      case 4:
        headers[name] = view.getInt32(offset);
        offset += 4;
        break;
      case 5:
      case 8:
        headers[name] = Number(view.getBigInt64(offset));
        offset += 8;
        break;
      case 6:
      case 7: {
        const length = view.getUint16(offset);
        offset += 2;
        const value = bytes.subarray(offset, offset + length);
        headers[name] = type === 7 ? textDecoder.decode(value) : Buffer.from(value).toString('base64');
        offset += length;
        break;
      }
      case 9:
        headers[name] = Buffer.from(bytes.subarray(offset, offset + 16)).toString('hex');
        offset += 16;
        break;
      default:
        throw new Error(`Unknown event-stream header type ${type}.`);
    }
  }
  return headers;
}

export class EventStreamDecoder {
  private buffer: Uint8Array = new Uint8Array(0);

  /** Feed raw bytes; returns every complete message now available. */
  push(chunk: Uint8Array): EventStreamMessage[] {
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer, 0);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;

    const messages: EventStreamMessage[] = [];
    while (this.buffer.length >= PRELUDE_LENGTH) {
      const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
      const totalLength = view.getUint32(0);
      const headersLength = view.getUint32(4);

      if (totalLength < MIN_MESSAGE_LENGTH || headersLength > totalLength - MIN_MESSAGE_LENGTH) {
        throw new Error('Malformed event-stream frame (bad prelude lengths).');
      }
      if (view.getUint32(8) !== crc32(this.buffer, 0, 8)) {
        throw new Error('Malformed event-stream frame (prelude CRC mismatch).');
      }
      if (this.buffer.length < totalLength) break;

      if (view.getUint32(totalLength - 4) !== crc32(this.buffer, 0, totalLength - 4)) {
        throw new Error('Malformed event-stream frame (message CRC mismatch).');
      }

      const headersStart = PRELUDE_LENGTH;
      const payloadStart = headersStart + headersLength;
      const payloadEnd = totalLength - 4;

      messages.push({
        headers: decodeHeaders(this.buffer.slice(headersStart, payloadStart)),
        payload: this.buffer.slice(payloadStart, payloadEnd),
      });
      this.buffer = this.buffer.slice(totalLength);
    }
    return messages;
  }

  get pendingBytes(): number {
    return this.buffer.length;
  }
}

/** Test helper / reference encoder for string headers only. */
export function encodeEventStreamMessage(headers: Record<string, string>, payload: string | Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const headerParts: Uint8Array[] = [];
  for (const [name, value] of Object.entries(headers)) {
    const nameBytes = encoder.encode(name);
    const valueBytes = encoder.encode(value);
    const part = new Uint8Array(1 + nameBytes.length + 1 + 2 + valueBytes.length);
    const dv = new DataView(part.buffer);
    part[0] = nameBytes.length;
    part.set(nameBytes, 1);
    part[1 + nameBytes.length] = 7;
    dv.setUint16(2 + nameBytes.length, valueBytes.length);
    part.set(valueBytes, 4 + nameBytes.length);
    headerParts.push(part);
  }
  const headersLength = headerParts.reduce((sum, part) => sum + part.length, 0);
  const payloadBytes = typeof payload === 'string' ? encoder.encode(payload) : payload;
  const totalLength = PRELUDE_LENGTH + headersLength + payloadBytes.length + 4;

  const out = new Uint8Array(totalLength);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, totalLength);
  dv.setUint32(4, headersLength);
  dv.setUint32(8, crc32(out, 0, 8));
  let offset = PRELUDE_LENGTH;
  for (const part of headerParts) {
    out.set(part, offset);
    offset += part.length;
  }
  out.set(payloadBytes, offset);
  dv.setUint32(totalLength - 4, crc32(out, 0, totalLength - 4));
  return out;
}
