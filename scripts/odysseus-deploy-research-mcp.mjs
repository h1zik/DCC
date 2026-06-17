import { Client } from "ssh2";
import { readFileSync } from "node:fs";

const [host, password] = process.argv.slice(2);
const base = "/root/odysseus/integrations/dcc-mcp";

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      let errOut = "";
      stream.on("close", (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(errOut || out || `exit ${code}`));
      });
      stream.on("data", (d) => {
        out += d.toString();
        process.stdout.write(d);
      });
      stream.stderr.on("data", (d) => {
        errOut += d.toString();
        process.stderr.write(d);
      });
    });
  });
}

function uploadText(conn, remotePath, content) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const ws = sftp.createWriteStream(remotePath);
      ws.on("close", resolve);
      ws.on("error", reject);
      ws.end(content);
    });
  });
}

const conn = new Client();
conn
  .on("ready", async () => {
    try {
      const researchTools = readFileSync(
        "C:/NEWDCC/DCC/mcp-server/src/register-research-tools.ts",
        "utf8",
      );
      await uploadText(conn, `${base}/src/register-research-tools.ts`, researchTools);
      console.log("Uploaded register-research-tools.ts");

      let createServer = await exec(conn, `cat ${base}/src/create-server.ts`);

      if (!createServer.includes("registerResearchTools")) {
        createServer = createServer.replace(
          'import { registerStrategicTools } from "./register-strategic-tools.js";',
          'import { registerStrategicTools } from "./register-strategic-tools.js";\nimport { registerResearchTools } from "./register-research-tools.js";',
        );
        createServer = createServer.replace(
          'version: "3.1.0"',
          'version: "3.2.0"',
        );
        createServer = createServer.replace(
          `  registerStrategicTools(server, {
    dccFetch,
    buildQuery,
    asText,
    limitSchema,
    roomNameSchema,
  });

  return server;`,
          `  registerStrategicTools(server, {
    dccFetch,
    buildQuery,
    asText,
    limitSchema,
    roomNameSchema,
  });

  registerResearchTools(server, {
    dccFetch,
    buildQuery,
    asText,
    limitSchema,
  });

  return server;`,
        );
        await uploadText(conn, `${base}/src/create-server.ts`, createServer);
        console.log("Patched create-server.ts");
      } else {
        console.log("create-server.ts already patched");
      }

      await exec(conn, `cd ${base} && npm run build`);
      await exec(conn, "docker restart odysseus-dominatus-1");
      console.log("Done: dcc-mcp built and Odysseus restarted");
      conn.end();
    } catch (e) {
      console.error(e);
      conn.end();
      process.exit(1);
    }
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
