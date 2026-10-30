import fs from "node:fs/promises";
const root = new URL("../dist/", import.meta.url);
async function bundle(output, entries) {
  const lines = [];
  for (const [name, file] of entries) {
    const value = JSON.parse(await fs.readFile(new URL(file, root), "utf8"));
    lines.push(`export const ${name} = ${JSON.stringify(value, null, 2)};`);
  }
  await fs.writeFile(new URL(output, root), lines.join("\n\n") + "\n");
}
await bundle("data.js", [
  ["modelConfig", "models/config.json"],
  ["modelHistory", "history.json"],
  ["modelAnatomy", "anatomy.json"],
]);
await bundle("research.js", [
  ["archive", "archive.json"],
  ["chronology", "chronology.json"],
  ["craft", "craft.json"],
  ["bibliography", "bibliography.json"],
]);
console.log("Updated the two local content modules.");
