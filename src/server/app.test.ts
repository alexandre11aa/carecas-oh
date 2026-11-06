// src/server/app.test.ts
import { mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { io as connect } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type App } from "./app.js";

const html = "<!doctype html><title>teste</title>";
let app: App;
let baseUrl: string;

beforeAll(async () => {
  const clientDir = mkdtempSync(path.join(tmpdir(), "carecas-client-"));
  writeFileSync(path.join(clientDir, "index.html"), html);
  app = createApp({ clientDir });
  await new Promise<void>((resolve) => app.httpServer.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(app.httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await app.io.close();
});

describe("servidor base", () => {
  it("responde_200_em_healthz", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("devolve_index_html_para_rota_de_sala", async () => {
    const res = await fetch(`${baseUrl}/sala/XXXX`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(html);
  });

  it("serve_index_html_na_raiz", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(html);
  });

  it("aceita_conexao_socket_io_no_mesmo_servidor", async () => {
    const socket = connect(baseUrl, { transports: ["websocket"] });
    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });
    expect(socket.connected).toBe(true);
    socket.close();
  });
});
