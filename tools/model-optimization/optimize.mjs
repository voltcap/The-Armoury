import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {EXTMeshoptCompression,EXTTextureWebP} from '@gltf-transform/extensions';
import {compressTexture,listTextureSlots} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';
import sharp from 'sharp';
import {io,structuralSnapshot,textureSnapshot,audit,sha256} from './audit.mjs';

// Asset-only pipeline: intentionally no mesh joining, flattening, quantization,
// welding, simplification, or node/primitive reordering. Study relies on those.
const here=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(process.argv[2]??path.join(here,'source-models'));
const output=path.resolve(process.argv[3]??path.join(here,'display-models'));
if(source===output)throw new Error('Output must be a new derivative directory.');
await fs.mkdir(output,{recursive:true});
await MeshoptEncoder.ready;
io.registerDependencies({'meshopt.encoder':MeshoptEncoder});
const credits=JSON.parse(await fs.readFile(path.join(source,'credits.json'),'utf8').catch(()=> '[]'));
const report=(JSON.parse(await fs.readFile(path.join(output,'optimization-manifest.json'),'utf8').catch(()=>'{"models":[]}')).models??[]);
function jsonChunk(glb){return JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString('utf8'));}
async function restoreExactNodeTransforms(input,out){
  const original=await fs.readFile(input),encoded=await fs.readFile(out);
  const a=jsonChunk(original),b=jsonChunk(encoded);
  assert.equal(a.nodes?.length,b.nodes?.length,'Node count changed');
  for(let i=0;i<(a.nodes?.length??0);i++){
    assert.equal(a.nodes[i].name,b.nodes[i].name,'Node order/name changed');
    // NodeIO removes almost-unit scales on serialization. Original matrix/TRS
    // JSON is restored so source axes and normalization remain exactly intact.
    for(const field of ['matrix','translation','rotation','scale']){
      delete b.nodes[i][field];
      if(field in a.nodes[i])b.nodes[i][field]=a.nodes[i][field];
    }
  }
  const json=Buffer.from(JSON.stringify(b)),padding=(4-json.length%4)%4;
  const body=encoded.subarray(20+encoded.readUInt32LE(12));
  const header=Buffer.alloc(20);encoded.copy(header,0,0,12);
  header.writeUInt32LE(20+json.length+padding+body.length,8);
  header.writeUInt32LE(json.length+padding,12);header.writeUInt32LE(0x4e4f534a,16);
  await fs.writeFile(out,Buffer.concat([header,json,Buffer.alloc(padding,32),body]));
}
for(const file of (await fs.readdir(source)).filter(f=>f.endsWith('.glb')).sort()){
  const input=path.join(source,file),out=path.join(output,file);
  const before=await audit(input),doc=await io.read(input),snapshot=structuralSnapshot(doc);
  const textureChecks=[];
  for(const [i,t] of doc.getRoot().listTextures().entries()){
    const original=t.getImage(),slots=listTextureSlots(t);
    const color=slots.length>0&&slots.every(s=>['baseColorTexture','emissiveTexture'].includes(s));
    // Existing assets are <=1024px; the cap applies only to future higher-res inputs.
    await compressTexture(t,{encoder:sharp,targetFormat:'webp',resize:[2048,2048],quality:90,effort:90,lossless:!color});
    const a=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const b=await sharp(t.getImage()).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(a.info.width,b.info.width,'Existing texture width changed unexpectedly');
    assert.equal(a.info.height,b.info.height,'Existing texture height changed unexpectedly');
    // The packed data maps and normals must decode bit-for-bit to the same RGB.
    if(!color)assert(a.data.equals(b.data),`Data texture ${i} changed pixels`);
    for(let j=3;j<a.data.length;j+=4)assert.equal(a.data[j],b.data[j],`Alpha changed in texture ${i}`);
    textureChecks.push({index:i,slots,encoding:color?'WebP quality 90':'WebP lossless',dataPixelsExact:!color,alphaExact:true,width:a.info.width,height:a.info.height});
  }
  if(doc.getRoot().listTextures().length)doc.createExtension(EXTTextureWebP).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  // QUANTIZE is the extension's lossless encoder path; no quantize() transform
  // is applied, so all accessor floats remain byte-identical after decoding.
  await io.write(out,doc);
  await restoreExactNodeTransforms(input,out);
  const after=await audit(out),actual=after.structure;
  // glTF Transform legitimately changes the generator string, preserving the
  // attribution fields and all other asset metadata.
  const normalized=s=>({...s,asset:{...s.asset,generator:undefined}});
  assert.deepEqual(normalized(actual),normalized(snapshot),`Structure/data changed: ${file}`);
  const {structure:discard1,...beforeSummary}=before,{structure:discard2,...afterSummary}=after;
  const record={file,license:credits.find(c=>c.file===file)?.license??snapshot.asset?.extras?.license??null,source:credits.find(c=>c.file===file)?.source??snapshot.asset?.extras?.source??null,before:beforeSummary,after:afterSummary,reductionPercent:+((1-after.bytes/before.bytes)*100).toFixed(2),verification:{sceneHierarchyTransformsMeshPrimitiveMaterialOrderExact:true,allVertexAttributeBytesExact:true,triangleOrderWindingCornersExact:true,textureChecks}};
  const oldIndex=report.findIndex(r=>r.file===file);
  if(oldIndex!==-1)report.splice(oldIndex,1);
  report.push(record);report.sort((a,b)=>a.file.localeCompare(b.file));
  console.log(`${file}: ${before.bytes} -> ${after.bytes} (${record.reductionPercent}% smaller); exact geometry verified`);
  await fs.writeFile(path.join(output,'optimization-manifest.json'),JSON.stringify({toolVersions:{gltfTransform:'4.5.1',meshoptimizer:'1.3.0',sharp:'0.35.5'},method:{meshopt:'lossless, no quantization or filtering',color:'WebP quality 90',data:'WebP lossless',maximumTextureDimension:2048,meshOrder:'preserved',nodeTransforms:'preserved'},models:report},null,2));
}
const totalBefore=report.reduce((s,r)=>s+r.before.bytes,0),totalAfter=report.reduce((s,r)=>s+r.after.bytes,0);
console.log(`TOTAL: ${totalBefore} -> ${totalAfter} (${((1-totalAfter/totalBefore)*100).toFixed(2)}% smaller)`);
await fs.copyFile(path.join(here,'node_modules/meshoptimizer/meshopt_decoder.mjs'),path.join(output,'meshopt_decoder.mjs'));
await fs.copyFile(path.join(here,'node_modules/meshoptimizer/LICENSE.md'),path.join(output,'meshoptimizer-LICENSE.md'));
