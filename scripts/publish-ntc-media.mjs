import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import OSS from 'ali-oss';

const source = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Supply the exported NTC media directory.');
const configPath = process.env.PICGO_CONFIG || path.join(os.homedir(), 'AppData/Roaming/picgo/data.json');
const picgo = JSON.parse((await fs.readFile(configPath, 'utf8')).replace(/^\uFEFF/, ''));
const config = picgo.picBed?.aliyun;
if (!config?.accessKeyId || !config.accessKeySecret || !config.bucket || !config.area) throw new Error('PicGo Aliyun uploader is incomplete.');
const client = new OSS({ accessKeyId: config.accessKeyId, accessKeySecret: config.accessKeySecret, bucket: config.bucket, region: config.area, secure: true, timeout: 120000 });
// Provider endpoint by default; custom origins can be selected after TLS validation.
const origin = process.env.NTC_MEDIA_ORIGIN || `https://${config.bucket}.${config.area}.aliyuncs.com`;
const types = { '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.json': 'application/json', '.csv': 'text/csv; charset=utf-8', '.zip': 'application/zip' };
async function files(directory) {
  const result = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) result.push(...await files(file));
    else if (types[path.extname(file)]) result.push(file);
  }
  return result;
}
const manifest = {};
const previous = await fs.readFile('src/lib/ntc-media.json','utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return {};throw error;});
const queue = await files(source);
let completed = 0,uploaded=0,reused=0;
async function worker() {
  while (queue.length) {
    const file = queue.shift();
    const relative = path.relative(source, file).replaceAll('\\', '/');
    const bytes = await fs.readFile(file);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const object = `portfolio/ntc/${hash.slice(0,16)}/${path.basename(file)}`;
    try {
      if(previous[relative]?.sha256===hash)reused++;
      else{await client.put(object, bytes, { headers: { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'public, max-age=31536000, immutable' } });uploaded++;}
    } catch (error) { throw new Error(`Upload failed for ${relative}: ${error.code || error.status || 'network error'}`); }
    manifest[relative] = { url: `${origin}/${object}`, bytes: bytes.length, sha256: hash };
    if (++completed % 20 === 0) console.log(`Processed ${completed} files`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
await fs.writeFile('src/lib/ntc-media.json', JSON.stringify(manifest, null, 2)+'\n');
console.log(`Uploaded ${uploaded}, reused ${reused} public media/data files; manifest saved. Credentials remain in PicGo.`);
