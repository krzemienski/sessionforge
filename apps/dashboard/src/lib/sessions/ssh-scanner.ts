/**
 * SSH/SFTP-based session scanner for remote hosts.
 * Mirrors the local scanner's output (SessionFileMeta[]) but fetches
 * files over SFTP and returns in-memory Buffers for parseSessionBuffer().
 */

import { Client, type SFTPWrapper } from "ssh2";
import { decryptPassword } from "@/lib/crypto/source-credentials";
import type { SessionFileMeta } from "./scanner";

interface ScanSourceConfig {
  host: string;
  port: number;
  username: string;
  encryptedPassword: string;
  basePath: string;
  label: string;
}

interface RemoteScanResult {
  meta: SessionFileMeta[];
  buffers: Map<string, Buffer>;
}

function sftpRealpath(sftp: SFTPWrapper, p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sftp.realpath(p, (err, absPath) => {
      if (err) reject(err);
      else resolve(absPath);
    });
  });
}

async function resolveBasePath(sftp: SFTPWrapper, p: string): Promise<string> {
  if (!p.startsWith("~")) return p;
  const home = await sftpRealpath(sftp, ".");
  if (p === "~") return home;
  return `${home}/${p.slice(2)}`;
}

function sftpReaddir(sftp: SFTPWrapper, dir: string): Promise<{ filename: string; attrs: { mtime: number } }[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(dir, (err, list) => {
      if (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT" || err.message?.includes("No such file")) {
          resolve([]);
        } else {
          reject(err);
        }
      } else {
        resolve(list.map((e) => ({ filename: e.filename, attrs: { mtime: e.attrs.mtime } })));
      }
    });
  });
}

function sftpReadFile(sftp: SFTPWrapper, path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = sftp.createReadStream(path);
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function connectSSH(config: ScanSourceConfig): Promise<{ client: Client; sftp: SFTPWrapper }> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const timeout = setTimeout(() => {
      client.end();
      reject(new Error(`SSH connection to ${config.host}:${config.port} timed out (10s)`));
    }, 10_000);

    client
      .on("ready", () => {
        clearTimeout(timeout);
        client.sftp((err, sftp) => {
          if (err) { client.end(); reject(err); return; }
          resolve({ client, sftp });
        });
      })
      .on("error", (err) => { clearTimeout(timeout); reject(err); })
      .connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: decryptPassword(config.encryptedPassword),
        readyTimeout: 10_000,
      });
  });
}

/**
 * Lightweight connection check — counts .jsonl files without reading contents.
 * Used by the "Check" button to verify connectivity and report session count.
 */
export async function checkRemoteConnection(
  source: ScanSourceConfig,
): Promise<{ sessionsFound: number }> {
  const { client, sftp } = await connectSSH(source);
  const basePath = await resolveBasePath(sftp, source.basePath);
  let count = 0;

  try {
    const projectDirs = await sftpReaddir(sftp, `${basePath}/projects`);

    const sessionDirs: string[] = [];
    for (const proj of projectDirs) {
      if (proj.filename.startsWith(".")) continue;
      sessionDirs.push(`${basePath}/projects/${proj.filename}`);
      sessionDirs.push(`${basePath}/projects/${proj.filename}/sessions`);
    }
    sessionDirs.push(`${basePath}/sessions`);

    for (const dir of sessionDirs) {
      const files = await sftpReaddir(sftp, dir);
      count += files.filter((f) => f.filename.endsWith(".jsonl")).length;
    }
  } finally {
    client.end();
  }

  return { sessionsFound: count };
}

export async function scanRemoteSessions(
  source: ScanSourceConfig,
  lookbackDays: number,
  skipSessionIds?: Set<string>,
): Promise<RemoteScanResult> {
  const meta: SessionFileMeta[] = [];
  const buffers = new Map<string, Buffer>();
  const cutoff = Date.now() - lookbackDays * 86_400_000;
  const sourcePrefix = `ssh://${source.host}`;

  const { client, sftp } = await connectSSH(source);
  const basePath = await resolveBasePath(sftp, source.basePath);

  try {
    // Scan both project-scoped and global sessions
    const projectDirs = await sftpReaddir(sftp, `${basePath}/projects`);

    const sessionDirs: string[] = [];
    for (const proj of projectDirs) {
      if (proj.filename.startsWith(".")) continue;
      // Session .jsonl files live directly in project dirs AND optionally in /sessions subdir
      sessionDirs.push(`${basePath}/projects/${proj.filename}`);
      sessionDirs.push(`${basePath}/projects/${proj.filename}/sessions`);
    }
    sessionDirs.push(`${basePath}/sessions`);

    for (const dir of sessionDirs) {
      const files = await sftpReaddir(sftp, dir);
      const jsonlFiles = files.filter((f) => f.filename.endsWith(".jsonl"));

      for (const file of jsonlFiles) {
        const mtimeMs = file.attrs.mtime * 1000;
        if (mtimeMs < cutoff) continue;

        const remotePath = `${dir}/${file.filename}`;
        const sessionId = file.filename.replace(".jsonl", "");

        // Skip sessions already indexed in the database
        if (skipSessionIds?.has(sessionId)) continue;
        const projectPath = dir.includes("/projects/")
          ? dir.split("/projects/")[1].split("/")[0]
          : undefined;

        const fileMeta: SessionFileMeta = {
          filePath: `${sourcePrefix}${remotePath}`,
          sessionId,
          projectPath: projectPath ?? "global",
          mtime: new Date(mtimeMs),
        };

        try {
          const buf = await sftpReadFile(sftp, remotePath);
          meta.push(fileMeta);
          buffers.set(fileMeta.filePath, buf);
        } catch {
          // Skip unreadable files
        }
      }
    }
  } finally {
    client.end();
  }

  return { meta, buffers };
}
