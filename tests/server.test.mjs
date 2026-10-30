import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createStaticServer } from "../server.mjs";

test("static server serves local assets and rejects invalid or escaping paths", async () => {
  const server = createStaticServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const request = (path, method = "GET") =>
    new Promise((resolve, reject) => {
      http
        .request(
          { host: "127.0.0.1", port: server.address().port, path, method },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () =>
              resolve({ status: res.statusCode, headers: res.headers, body }),
            );
          },
        )
        .on("error", reject)
        .end();
    });
  try {
    const index = await request("/");
    assert.equal(index.status, 200);
    assert.match(index.body, /<title>The Armoury<\/title>/);
    const module = await request("/suite.js?version=1");
    assert.equal(module.status, 200);
    assert.match(module.headers["content-type"], /javascript/);
    const head = await request("/", "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.body, "");
    assert.equal((await request("/%E0%A4%A")).status, 400);
    assert.equal((await request("/%2e%2e/README.md")).status, 403);
    assert.equal((await request("/missing-file")).status, 404);
    assert.equal((await request("/", "POST")).status, 405);
  } finally {
    server.close();
    await once(server, "close");
  }
});
