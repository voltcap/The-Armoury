import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "./vendor/libs/meshopt_decoder.mjs";
import { createModelCache } from "./model-cache.js?v=1.2.0";

export const createModelLoader = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export function disposeModel(root, textures = true) {
  if (!root) return;
  const maps = new Set();
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (textures) for (const value of Object.values(material))
        if (value?.isTexture) maps.add(value);
      material.dispose();
    }
  });
  maps.forEach((texture) => texture.dispose());
}

const acquire = createModelCache(
  async (url) => (await createModelLoader().loadAsync(url)).scene,
  disposeModel,
);

// A lease keeps shared textures alive while any of the three viewers uses them.
export function acquireModel(url) {
  return acquire(new URL(url, import.meta.url).href);
}
