// Read a downloaded RAM key CSV locally. Never write credentials into this repo.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import OSS from 'ali-oss';

const [csvPath,probePath]=process.argv.slice(2);
if(!csvPath||!probePath)throw new Error('Supply RAM CSV and a public portfolio image to verify upload.');
const raw=await fs.readFile(csvPath);
const text=raw.toString(raw[0]===255&&raw[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'');
const rows=text.trim().split(/\r?\n/).map(line=>line.split(',').map(x=>x.trim().replace(/^"|"$/g,'')));
const header=rows[0].map(x=>x.replace(/[^a-z]/gi,'').toLowerCase());
const idIndex=header.indexOf('accesskeyid'),secretIndex=header.indexOf('accesskeysecret');
const accessKeyId=rows[1]?.[idIndex],accessKeySecret=rows[1]?.[secretIndex];
if(!/^LTAI[A-Za-z0-9]+$/.test(accessKeyId||'')||!accessKeySecret)throw new Error('RAM CSV format is not recognized.');
const configPath=process.env.PICGO_CONFIG||path.join(os.homedir(),'AppData/Roaming/picgo/data.json');
const original=await fs.readFile(configPath,'utf8');
const data=JSON.parse(original.replace(/^\uFEFF/,'')),config=data.picBed.aliyun;
const client=new OSS({accessKeyId,accessKeySecret,bucket:config.bucket,region:config.area,secure:true});
const bytes=await fs.readFile(probePath),hash=createHash('sha256').update(bytes).digest('hex').slice(0,16);
try{await client.put(`portfolio/ntc/${hash}/${path.basename(probePath)}`,bytes,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable'}});}catch(error){throw new Error(`Upload verification failed: ${error.code||error.status||'network error'}`);}
const replacement={...config,accessKeyId,accessKeySecret};
data.picBed.aliyun=replacement;
const profiles=data.uploader?.aliyun;
if(profiles?.configList){const selected=profiles.configList.find(x=>x._id===profiles.defaultId||x._id===config._id);if(selected)Object.assign(selected,{accessKeyId,accessKeySecret});}
const backup=path.join(path.dirname(configPath),'data.before-ntc-key-rotation.json');
await fs.writeFile(backup,original,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
const temporary=configPath+'.ntc.tmp';await fs.writeFile(temporary,JSON.stringify(data,null,2));await fs.rename(temporary,configPath);
console.log('Upload verified. PicGo active uploader and profile updated; local backup retained.');
