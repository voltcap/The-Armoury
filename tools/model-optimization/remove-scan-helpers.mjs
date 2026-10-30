import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {prune} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';
import {EXTMeshoptCompression} from '@gltf-transform/extensions';
import {io,audit,structuralSnapshot,sha256} from './audit.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const output=path.resolve(process.argv[2]??path.join(here,'display-models'));
const source=path.resolve(process.argv[3]??path.join(here,'source-models'));
const manifestPath=path.join(output,'optimization-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const plans=[{file:'bronze_age_sword_oc078.glb',node:'Celtic_Bronze_Leaf_0',vertices:52386,meshes:4},{file:'moonbrand_arming_sword.glb',node:'Object_4',vertices:24149,meshes:31}];
await MeshoptEncoder.ready;
io.registerDependencies({'meshopt.encoder':MeshoptEncoder});
const jsonChunk=b=>JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8'));
function rebuildGlb(b,json){
  const text=Buffer.from(JSON.stringify(json)),pad=(4-text.length%4)%4,body=b.subarray(20+b.readUInt32LE(12));
  const header=Buffer.from(b.subarray(0,20));header.writeUInt32LE(20+text.length+pad+body.length,8);header.writeUInt32LE(text.length+pad,12);
  return Buffer.concat([header,text,Buffer.alloc(pad,32),body]);
}
function retainedSnapshot(doc){
 const s=structuralSnapshot(doc),mesh=doc.getRoot().listMeshes()[0];
 const node=doc.getRoot().listNodes().find(n=>n.getMesh()===mesh);
 const materialNames=doc.getRoot().listMaterials().map(m=>m.getName());
 const usedMaterials=new Set(s.meshes[0].primitives.map(p=>p.material));
 const textures=doc.getRoot().listTextures();
 const materials=s.materials.filter((m,i)=>usedMaterials.has(i)).map(m=>({...m,textures:m.textures.map(t=>({...t,texture:t.texture===-1?null:sha256(textures[t.texture].getImage())}))}));
 return {mesh:{...s.meshes[0],primitives:s.meshes[0].primitives.map(p=>({...p,material:materialNames[p.material]}))},materials,worldMatrix:node.getWorldMatrix()};
}
for(const plan of plans){
 const filename=path.join(output,plan.file),record=manifest.models.find(r=>r.file===plan.file);
 assert(record,'Missing manifest record');
 const original=await fs.readFile(filename),originalJson=jsonChunk(original),doc=await io.read(filename),root=doc.getRoot();
 assert([1,plan.meshes].includes(root.listMeshes().length),'Unexpected input mesh count');
 const retainedMesh=root.listMeshes()[0],retainedNodes=root.listNodes().filter(n=>n.getMesh()===retainedMesh);
 assert.equal(retainedNodes.length,1);assert.equal(retainedNodes[0].getName(),plan.node);
 assert.equal(retainedMesh.listPrimitives()[0].getAttribute('POSITION').getCount(),plan.vertices);
 const retainedBefore=retainedSnapshot(doc);
 const allNodes=root.listNodes(),nodeDefinitions=new Map(allNodes.map((n,i)=>[n,originalJson.nodes[i]]));
 const textureDefinitions=new Map(root.listTextures().map(t=>[t,{hash:sha256(t.getImage()),beforeIndex:root.listTextures().indexOf(t)}]));
 const removedNodeNames=[...(record.modifications?.helperRemoval?.removedNodeNames??[])];
 const keepNodes=new Set(retainedNodes);
 for(let n=retainedNodes[0].getParentNode();n;n=n.getParentNode())keepNodes.add(n);
 // Retain only the actual sword and its complete transform ancestry. This also
 // removes animated but now-empty annotation parents and their animation data.
 for(const node of [...allNodes])if(!keepNodes.has(node)){if(!removedNodeNames.includes(node.getName()))removedNodeNames.push(node.getName());node.dispose();}
 await doc.transform(prune({keepAttributes:true,keepSolidTextures:true,keepExtras:false}));
 assert.equal(root.listMeshes().length,1);
 assert.deepEqual(retainedSnapshot(doc),retainedBefore,'Retained source geometry/world matrix changed during pruning');
 const finalNodes=root.listNodes(),finalDefinitions=finalNodes.map(n=>nodeDefinitions.get(n));
 const retainedTextures=root.listTextures().map((t,i)=>({index:i,...textureDefinitions.get(t)}));
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 await io.write(filename,doc);
 const encoded=await fs.readFile(filename),encodedJson=jsonChunk(encoded);
 assert.equal(encodedJson.nodes.length,finalDefinitions.length);
 for(let i=0;i<finalDefinitions.length;i++){
   assert.equal(encodedJson.nodes[i].name,finalDefinitions[i].name);
   for(const key of ['matrix','translation','rotation','scale']){
     delete encodedJson.nodes[i][key];
     if(key in finalDefinitions[i])encodedJson.nodes[i][key]=finalDefinitions[i][key];
   }
 }
 await fs.writeFile(filename,rebuildGlb(encoded,encodedJson));
 const after=await audit(filename),decoded=await io.read(filename);
 assert.deepEqual(retainedSnapshot(decoded),retainedBefore,'Retained source geometry/world matrix changed after serialization');
 assert.deepEqual({...decoded.getRoot().getAsset(),generator:null},{...root.getAsset(),generator:null},'Attribution changed');
  const originalSource=await io.read(path.join(source,plan.file));
  const sourceSignature=retainedSnapshot(originalSource),displaySignature=retainedSnapshot(decoded);
  assert.deepEqual(displaySignature.mesh,sourceSignature.mesh,'Retained sword differs from original source mesh');
  assert.deepEqual(displaySignature.worldMatrix,sourceSignature.worldMatrix,'Retained sword differs from original source world transform');
 for(const [i,t] of decoded.getRoot().listTextures().entries())assert.equal(sha256(t.getImage()),retainedTextures[i].hash,'Retained texture bytes changed');
 const {structure,...summary}=after;
 record.afterBeforeHelperRemoval??=record.after;
 record.after=summary;
 record.reductionPercent=+((1-after.bytes/record.before.bytes)*100).toFixed(2);
 record.modifications={...(record.modifications??{}),helperRemoval:{sourceSwordMesh:0,retainedNode:plan.node,removedMeshCount:plan.meshes-1,removedNodeNames,removedUnusedResources:true,retainedVertexCount:plan.vertices,retainedWorldMatrix:retainedBefore.worldMatrix}};
 record.verification={retainedSwordGeometryAttributesByteExact:true,retainedSwordTriangleOrderWindingCornersExact:true,retainedSwordWorldTransformExact:true,retainedSwordComparedDirectlyWithOriginalSource:true,retainedMaterialsAndTexturesUnchanged:true,textureChecks:retainedTextures.map(t=>{const previous=record.verification.textureChecks.find(c=>c.index===t.beforeIndex);return {...previous,index:t.index,sourceTextureIndex:previous.sourceTextureIndex??t.beforeIndex,retainedEncodedBytesExact:true};})};
 console.log(`${plan.file}: ${original.byteLength} -> ${after.bytes}; original ${record.before.bytes}; -${record.reductionPercent}%; retained mesh/world transform exact`);
}
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2));
const a=manifest.models.reduce((s,r)=>s+r.before.bytes,0),b=manifest.models.reduce((s,r)=>s+r.after.bytes,0);
console.log(`TOTAL: ${a} -> ${b} (${((1-b/a)*100).toFixed(2)}% smaller)`);
