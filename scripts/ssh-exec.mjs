import { Client } from "ssh2";

const host = process.argv[2];
const password = process.argv[3];
const cmd = process.argv.slice(4).join(" ");

const conn = new Client();
conn
  .on("ready", () => {
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error(err.message);
        conn.end();
        process.exit(1);
      }
      stream.on("close", (code) => {
        conn.end();
        process.exit(code ?? 0);
      });
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.stdout.on("data", (d) => process.stdout.write(d));
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
