import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ssh2 from "ssh2";

// Usage: node scripts/fake-robot.mjs <logs folder> [--port 2222]
// A pretend roboRIO for testing Get logs from robot without a robot: an SFTP server on 127.0.0.1 that
// serves <logs folder> as /U/logs and takes the roboRIO's login (lvuser, no password). Files can be read and
// deleted (and empty folders removed) but not written. Deleting really deletes them from <logs folder>.
// Start Power Tool with POWERLIB_ROBOT=127.0.0.1:2222 so it looks here instead of the real robot addresses.

const { STATUS_CODE } = ssh2.utils.sftp;
const robotRoot = "/U/logs";

/** Starts the fake robot serving `folder`; resolves with the server once it's listening. */
export function startFakeRobot(folder, port = 2222) {
  const hostKey = ssh2.utils.generateKeyPairSync("ed25519").private;
  const local = remote => {
    const clean = path.posix.normalize(remote || "/");
    if (clean !== robotRoot && !clean.startsWith(`${robotRoot}/`)) return null;
    return path.join(folder, ...clean.slice(robotRoot.length).split("/").filter(Boolean));
  };
  const attrs = stats => ({ mode: stats.mode, uid: 0, gid: 0, size: stats.size, atime: Math.floor(stats.atimeMs / 1000), mtime: Math.floor(stats.mtimeMs / 1000) });

  const server = new ssh2.Server({ hostKeys: [hostKey] }, client => {
    client.on("authentication", context => {
      const blank = context.method === "none" || (context.method === "password" && context.password === "");
      if (context.username === "lvuser" && blank) context.accept(); else context.reject(["none", "password"]);
    });
    client.on("error", () => {});
    client.on("ready", () => client.on("session", acceptSession => acceptSession().on("sftp", acceptSftp => {
      const sftp = acceptSftp();
      const handles = new Map();
      let nextHandle = 0;
      const newHandle = value => { const handle = Buffer.alloc(4); handle.writeUInt32BE(nextHandle++); handles.set(handle.toString("hex"), value); return handle; };
      const fail = (id, code = STATUS_CODE.NO_SUCH_FILE) => sftp.status(id, code);

      sftp.on("REALPATH", (id, remote) => sftp.name(id, [{ filename: path.posix.normalize(remote === "." ? "/" : remote), longname: "", attrs: {} }]));
      const stat = (id, remote) => {
        const file = local(remote);
        if (!file || !fs.existsSync(file)) return fail(id);
        sftp.attrs(id, attrs(fs.statSync(file)));
      };
      sftp.on("STAT", stat);
      sftp.on("LSTAT", stat);
      sftp.on("OPEN", (id, remote, flags) => {
        const file = local(remote);
        if (!file || !fs.existsSync(file) || flags !== ssh2.utils.sftp.OPEN_MODE.READ) return fail(id, file ? STATUS_CODE.PERMISSION_DENIED : STATUS_CODE.NO_SUCH_FILE);
        sftp.handle(id, newHandle({ fd: fs.openSync(file, "r") }));
      });
      sftp.on("FSTAT", (id, handle) => {
        const open = handles.get(handle.toString("hex"));
        if (!open?.fd) return fail(id, STATUS_CODE.FAILURE);
        sftp.attrs(id, attrs(fs.fstatSync(open.fd)));
      });
      sftp.on("READ", (id, handle, offset, length) => {
        const open = handles.get(handle.toString("hex"));
        if (!open?.fd) return fail(id, STATUS_CODE.FAILURE);
        const buffer = Buffer.alloc(length);
        const read = fs.readSync(open.fd, buffer, 0, length, offset);
        if (read === 0) sftp.status(id, STATUS_CODE.EOF); else sftp.data(id, buffer.subarray(0, read));
      });
      sftp.on("OPENDIR", (id, remote) => {
        const dir = local(remote);
        if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return fail(id);
        const entries = fs.readdirSync(dir).map(name => ({ filename: name, longname: name, attrs: attrs(fs.statSync(path.join(dir, name))) }));
        sftp.handle(id, newHandle({ entries, sent: false }));
      });
      sftp.on("READDIR", (id, handle) => {
        const open = handles.get(handle.toString("hex"));
        if (!open?.entries || open.sent) return sftp.status(id, STATUS_CODE.EOF);
        open.sent = true;
        if (open.entries.length === 0) return sftp.status(id, STATUS_CODE.EOF);
        sftp.name(id, open.entries);
      });
      sftp.on("REMOVE", (id, remote) => {
        const file = local(remote);
        if (!file || !fs.existsSync(file)) return fail(id);
        if (!fs.statSync(file).isFile()) return fail(id, STATUS_CODE.FAILURE);
        fs.unlinkSync(file);
        sftp.status(id, STATUS_CODE.OK);
      });
      sftp.on("RMDIR", (id, remote) => {
        const dir = local(remote);
        if (!dir || path.posix.normalize(remote) === robotRoot || !fs.existsSync(dir)) return fail(id);
        if (!fs.statSync(dir).isDirectory() || fs.readdirSync(dir).length > 0) return fail(id, STATUS_CODE.FAILURE);
        fs.rmdirSync(dir);
        sftp.status(id, STATUS_CODE.OK);
      });
      sftp.on("CLOSE", (id, handle) => {
        const key = handle.toString("hex");
        const open = handles.get(key);
        if (open?.fd !== undefined) fs.closeSync(open.fd);
        handles.delete(key);
        sftp.status(id, STATUS_CODE.OK);
      });
    })));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2];
  const portFlag = process.argv.indexOf("--port");
  const port = portFlag > 0 ? Number(process.argv[portFlag + 1]) : 2222;
  if (!folder || !fs.existsSync(folder)) {
    console.error("Usage: node scripts/fake-robot.mjs <logs folder> [--port 2222]");
    process.exit(1);
  }
  await startFakeRobot(path.resolve(folder), port);
  console.log(`Fake robot serving ${path.resolve(folder)} as ${robotRoot} on 127.0.0.1:${port} (login lvuser, no password).`);
  console.log(`Start Power Tool with POWERLIB_ROBOT=127.0.0.1:${port}. Ctrl+C to stop.`);
}
