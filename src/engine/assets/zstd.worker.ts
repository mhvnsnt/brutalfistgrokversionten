import { decompress } from 'fzstd';

type Job = { id: number; buf: ArrayBuffer };

self.onmessage = (ev: MessageEvent<Job>) => {
  const { id, buf } = ev.data;
  try {
    const u8 = new Uint8Array(buf);
    const zstd = u8.length >= 4 && u8[0] === 0x28 && u8[1] === 0xb5 && u8[2] === 0x2f && u8[3] === 0xfd;
    const raw = zstd ? decompress(u8) : u8;
    const json = JSON.parse(new TextDecoder().decode(raw));
    self.postMessage({ id, ok: true, json });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
