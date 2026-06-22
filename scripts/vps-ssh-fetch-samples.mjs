import { Client } from "ssh2";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const files = [
  "/root/shopee-product-search-sample.json",
  "/root/shopee-shop-products-sample.json",
  "/root/tokopedia-product-search-sample.json",
  "/root/tokopedia-shop-products-sample.json",
];

const outDir = join(process.cwd(), "tmp-vps-samples");
mkdirSync(outDir, { recursive: true });

const conn = new Client();
conn
  .on("ready", () => {
    let pending = files.length;
    for (const remote of files) {
      const name = remote.split("/").pop();
      conn.exec(`cat ${remote}`, (err, stream) => {
        if (err) {
          console.error(err);
          process.exit(1);
        }
        const chunks = [];
        stream.on("data", (d) => chunks.push(d));
        stream.on("close", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          writeFileSync(join(outDir, name), text);
          console.log(`saved ${name} (${text.length} bytes)`);
          pending -= 1;
          if (pending === 0) conn.end();
        });
      });
    }
  })
  .on("error", (err) => {
    console.error(err.message);
    process.exit(1);
  })
  .connect({
    host: "194.233.93.236",
    port: 22,
    username: "root",
    password: process.env.VPS_SSH_PASSWORD,
    readyTimeout: 20000,
  });
