import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {listTextureSlots} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';

export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
await MeshoptDecoder.ready;
export const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const digestArray = a => a ? sha256(Buffer.from(a.buffer,a.byteOffset,a.byteLength)) : null;
// Triangle codec may rotate the three corners cyclically. This hash verifies
// triangle order, winding, and every corner without treating rotation as a change.
function indexSignature(p) {
  const a=p.getIndices()?.getArray();
  if (!a) return null;
  if (p.getMode()!==4) return digestArray(a);
  const b=new Uint32Array(a.length);
  for(let i=0;i<a.length;i+=3){
    let j=0;if(a[i+1]<a[i+j])j=1;if(a[i+2]<a[i+j])j=2;
    for(let k=0;k<3;k++) b[i+k]=a[i+(j+k)%3];
  }
  return digestArray(b);
}
export function structuralSnapshot(doc){
  const r=doc.getRoot(), nodes=r.listNodes(), meshes=r.listMeshes(), mats=r.listMaterials(), textures=r.listTextures();
  return {
    scenes:r.listScenes().map(s=>({name:s.getName(),children:s.listChildren().map(n=>nodes.indexOf(n))})),
    nodes:nodes.map(n=>({name:n.getName(),translation:n.getTranslation(),rotation:n.getRotation(),scale:n.getScale(),mesh:meshes.indexOf(n.getMesh()),children:n.listChildren().map(c=>nodes.indexOf(c))})),
    meshes:meshes.map(m=>({name:m.getName(),primitives:m.listPrimitives().map(p=>({mode:p.getMode(),material:mats.indexOf(p.getMaterial()),vertices:p.getAttribute('POSITION')?.getCount(),indices:p.getIndices()?.getCount(),triangleSignature:indexSignature(p),attributes:p.listSemantics().map(s=>({semantic:s,type:p.getAttribute(s).getType(),normalized:p.getAttribute(s).getNormalized(),hash:digestArray(p.getAttribute(s).getArray())}))}))})),
    materials:mats.map(m=>({name:m.getName(),baseColor:m.getBaseColorFactor(),metallic:m.getMetallicFactor(),roughness:m.getRoughnessFactor(),normalScale:m.getNormalScale(),occlusionStrength:m.getOcclusionStrength(),emissive:m.getEmissiveFactor(),alphaMode:m.getAlphaMode(),alphaCutoff:m.getAlphaCutoff(),doubleSided:m.getDoubleSided(),textures:['BaseColor','MetallicRoughness','Normal','Occlusion','Emissive'].map(s=>{
      const info=m['get'+s+'TextureInfo']();
      return {slot:s,texture:textures.indexOf(m['get'+s+'Texture']()),sampler:info?{texCoord:info.getTexCoord(),minFilter:info.getMinFilter(),magFilter:info.getMagFilter(),wrapS:info.getWrapS(),wrapT:info.getWrapT()}:null};
    })})),
    asset:doc.getRoot().getAsset(),extras:doc.getRoot().getExtras(),
  };
}
export async function textureSnapshot(doc){
  return await Promise.all(doc.getRoot().listTextures().map(async(t,i)=>{
    const image=t.getImage(), meta=await sharp(image).metadata();
    const stats=await sharp(image).stats();
    return {index:i,name:t.getName(),slots:listTextureSlots(t),mime:t.getMimeType(),bytes:image.byteLength,width:meta.width,height:meta.height,channels:meta.channels,hasAlpha:meta.hasAlpha,isOpaque:stats.isOpaque,alphaRange:meta.hasAlpha?[stats.channels.at(-1).min,stats.channels.at(-1).max]:null};
  }));
}
export async function audit(file){
  const bin=await fs.readFile(file),doc=await io.read(file),structure=structuralSnapshot(doc);
  return {file:path.basename(file),bytes:bin.byteLength,sha256:sha256(bin),meshCount:structure.meshes.length,primitiveCount:structure.meshes.reduce((s,m)=>s+m.primitives.length,0),vertices:structure.meshes.flatMap(m=>m.primitives).reduce((s,p)=>s+p.vertices,0),triangles:structure.meshes.flatMap(m=>m.primitives).reduce((s,p)=>s+(p.indices??p.vertices)/3,0),textures:await textureSnapshot(doc),structure};
}
if(process.argv[1]===new URL(import.meta.url).pathname.slice(1).replaceAll('/','\\') || process.argv[1]?.endsWith('audit.mjs')){
 const source=path.resolve(process.argv[2]??'source-models'), files=(await fs.readdir(source)).filter(f=>f.endsWith('.glb'));
 const results=[];for(const file of files)results.push(await audit(path.join(source,file)));
 await fs.writeFile('audit-original.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(({structure,...a})=>a),null,2));
}
