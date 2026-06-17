import { Client } from "ssh2";
import { readFileSync } from "node:fs";

const [host, password, localPath, remotePath] = process.argv.slice(2);
const content = readFileSync(localPath);

const conn = new Client();
conn
  .on("ready", () => {
    conn.sftp((err, sftp) => {
      if (err) {
        console.error(err.message);
        conn.end();
        process.exit(1);
      }
      const ws = sftp.createWriteStream(remotePath);
      ws.on("close", () => {
        conn.end();
        console.log(`Uploaded ${localPath} -> ${remotePath}`);
      });
      ws.on("error", (e) => {
        console.error(e.message);
        conn.end();
        process.exit(1);
      });
      ws.end(content);
    });
  })
  .on("error", (err) => {
    console.error(err.message);
    process.exit(1);
  })
  .connect({
    host,
    port: 22,
    username: "root",
    password,
    readyTimeout: 20000,
  });
