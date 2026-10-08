/**
 * Headless GLB loading for the retarget harness.
 *
 * GLTFLoader needs a DOM only for textures, and the harness needs none: the
 * JSON chunk is rewritten without images/textures before parsing, so any
 * shipped or staged GLB loads in plain Node with its skeleton, skin and clips.
 * Meshopt is decoded (the Bannon GLBs are Meshopt-compressed).
 */
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

/** @param {Buffer} buf */
export function stripTextures(buf) {
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error('not a GLB');
  let off = 12;
  const chunks = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
    off += 8 + len;
  }
  const json = JSON.parse(chunks[0].data.toString('utf8'));
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const m of json.materials ?? []) {
    const p = m.pbrMetallicRoughness;
    if (p) { delete p.baseColorTexture; delete p.metallicRoughnessTexture; }
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; delete m.extensions;
  }
  const keep = (/** @type {string[] | undefined} */ list) => list?.filter((/** @type {string} */ e) => !/texture|materials_/i.test(e));
  if (json.extensionsUsed) json.extensionsUsed = keep(json.extensionsUsed);
  if (json.extensionsRequired) json.extensionsRequired = keep(json.extensionsRequired);
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const parts = [{ type: JSON_CHUNK, data: js }, ...chunks.slice(1)];
  const out = [];
  let total = 12;
  for (const p of parts) {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(p.data.length, 0);
    h.writeUInt32LE(p.type, 4);
    out.push(h, p.data);
    total += 8 + p.data.length;
  }
  const hdr = Buffer.alloc(12);
  hdr.writeUInt32LE(GLB_MAGIC, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(total, 8);
  return Buffer.concat([hdr, ...out]);
}

/** @type {GLTFLoader | null} */
let loader = null;
/** @param {string} file */
export async function loadGlbNode(file) {
  if (!loader) { loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); }
  const l = loader;
  const b = stripTextures(readFileSync(file));
  return l.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
}
