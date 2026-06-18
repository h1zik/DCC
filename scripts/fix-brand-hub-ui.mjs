import fs from "fs";
import path from "path";

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
  }
  return out;
}

const root = "src/app/(dashboard)/brand-hub";
const fixes = [
  [/@\/components\/brand-hub\//g, "@/components/research-hub/"],
  [/ownerBrandId: room\.ownerBrandId/g, "brandId: room.brandId"],
  [/ownerBrandId: room\?\.ownerBrandId/g, "brandId: room?.brandId"],
  [/where: \{ ownerBrandId:/g, "where: { brandId:"],
  [
    /select: \{ id: true, name: true, ownerBrandId: true, brand: \{ select: \{ name: true \} \} \}/g,
    "select: { id: true, name: true, brandId: true, brand: { select: { name: true } } }",
  ],
  [/from "\.\.\/use-review-intel-polling"/g, 'from "../use-brand-review-intel-polling"'],
  [/createTrendWatchlist/g, "refreshGlobalBrandTrendDigest"],
  [/deleteTrendWatchlist/g, "deleteBrandTrendDigest"],
  [/refreshTrendWatchlist/g, "refreshBrandTrendDigest"],
  [/refreshGlobalTrendDigest/g, "refreshGlobalBrandTrendDigest"],
];

for (const file of walk(root)) {
  let content = fs.readFileSync(file, "utf8");
  let changed = false;
  for (const [re, rep] of fixes) {
    if (re.test(content)) {
      content = content.replace(re, rep);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, content);
    console.log("Fixed", file);
  }
}
