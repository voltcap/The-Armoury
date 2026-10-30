import * as T from "./vendor/three.module.js";
import { RoomEnvironment } from "./vendor/environments/RoomEnvironment.js";

// The same studio surrounds every exhibit, including the reverse of a blade.
export function lightExhibit(renderer, scene, camera) {
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const generator = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  room.add(new T.AmbientLight(0xffffff, 0.8));
  const environment = generator.fromScene(room, 0.02);
  scene.environment = environment.texture;
  generator.dispose();
  room.dispose();
  scene.add(new T.AmbientLight(0xffffff, 0.65));
  scene.add(new T.HemisphereLight(0xf5f1e9, 0xf5f1e9, 1.5));
  for (const position of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
    const light = new T.DirectionalLight(0xffffff, 0.8);
    light.position.set(...position).multiplyScalar(10);
    scene.add(light);
  }
  scene.add(camera);
  for (const [intensity, position] of [[3.2,[-3,4,4]],[2.2,[4,-3,4]]]) {
    const light = new T.DirectionalLight(0xfff7eb, intensity);
    const target = new T.Object3D();
    target.position.z = -8;
    camera.add(target);
    light.target = target;
    light.position.set(...position);
    camera.add(light);
  }
  return environment;
}

export function exhibitMaterial(original, { wireframe = false, dim = 1 } = {}) {
  const material = original.clone();
  material.side = T.DoubleSide;
  material.wireframe = wireframe;
  if (material.color) {
    material.color.r = Math.max(0.025, material.color.r);
    material.color.g = Math.max(0.023, material.color.g);
    material.color.b = Math.max(0.02, material.color.b);
    material.color.multiplyScalar(dim);
  }
  if ("envMapIntensity" in material) material.envMapIntensity = 1.45;
  if ("roughness" in material) material.roughness = Math.max(0.35, material.roughness);
  return material;
}
