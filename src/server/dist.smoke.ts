// src/server/dist.smoke.ts
// Smoke test do servidor COMPILADO (dist/server). Rode `npm run build` antes: `npm run smoke`.
// Pega erros que só aparecem ao executar o JS emitido (ex.: imports ESM sem extensão).
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { io as connect } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const entry = path.resolve("dist/server/server/index.js");
const port = 3900 + Math.floor(Math.random() * 90);
const baseUrl = `http://127.0.0.1:${port}`;
let child: ChildProcess;
let output = "";

async function waitHealthy(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Servidor compilado encerrou (código ${child.exitCode}):\n${output}`);
    }
    try {
      const res = await fetch(`${baseUrl}/healthz`);
      if (res.status === 200) return;
    } catch {
      // ainda não está escutando
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor compilado não respondeu em /healthz:\n${output}`);
}

beforeAll(async () => {
  if (!existsSync(entry)) throw new Error(`${entry} não existe: rode "npm run build" antes.`);
  const clientDir = mkdtempSync(path.join(tmpdir(), "carecas-smoke-"));
  writeFileSync(path.join(clientDir, "index.html"), "<!doctype html><title>smoke</title>");
  child = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT: String(port), CLIENT_DIR: clientDir },
  });
  child.stdout?.on("data", (d) => (output += String(d)));
  child.stderr?.on("data", (d) => (output += String(d)));
  await waitHealthy(15_000);
}, 20_000);

afterAll(() => {
  child?.kill();
});

describe("servidor compilado", () => {
  it("responde_200_em_healthz", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
  });

  it("cria_sala_por_socket_io", async () => {
    const socket = connect(baseUrl, { transports: ["websocket"] });
    const created = await new Promise<{ room: { code: string } }>((resolve, reject) => {
      socket.on("connect_error", reject);
      socket.on("room:created", resolve);
      socket.on("connect", () => socket.emit("room:create", { nickname: "Ana" }));
    });
    socket.close();
    expect(created.room.code).toHaveLength(4);
  });
});
