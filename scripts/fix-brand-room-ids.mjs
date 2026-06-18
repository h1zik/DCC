import fs from "fs";
import path from "path";

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const fixes = [
  [/ownerBrandId: string \| null/g, "brandId: string | null"],
  [/selectedRoom\?\.ownerBrandId/g, "selectedRoom?.brandId"],
  [/selectedRoom\.ownerBrandId/g, "selectedRoom.brandId"],
  [/ownerBrandId: r\.ownerBrandId/g, "brandId: r.brandId"],
  [/ownerBrandId: true/g, "brandId: true"],
  [/ownerBrandId: selectedRoom\.brandId/g, "brandId: selectedRoom.brandId"],
  [/ownerBrandId: selectedRoom\.brandId!/g, "brandId: selectedRoom.brandId!"],
];

for (const file of walk("src/app/(dashboard)/brand-hub")) {
  let content = fs.readFileSync(file, "utf8");
  let changed = false;
  for (const [re, rep] of fixes) {
    const next = content.replace(re, rep);
    if (next !== content) {
      content = next;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, content);
    console.log("Fixed", file);
  }
}
