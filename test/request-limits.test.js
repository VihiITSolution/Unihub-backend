const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

process.env.NODE_ENV = "production";

const app = require("../src/app");

async function withServer(fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("an oversized JSON body is rejected with 413, not 500", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blob: "A".repeat(3 * 1024 * 1024) }),
    });
    assert.strictEqual(response.status, 413);
    const body = await response.json();
    assert.strictEqual(body.success, false);
  });
});

test("an ordinary JSON body is not rejected by the size limit", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "x" }),
    });
    assert.notStrictEqual(response.status, 413);
  });
});

test("security headers are present on responses", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/health`);
    assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
    assert.match(response.headers.get("strict-transport-security") || "", /preload/);
    assert.match(response.headers.get("permissions-policy") || "", /camera=\(\)/);
    assert.strictEqual(response.headers.get("x-frame-options"), "DENY");
    assert.strictEqual(response.headers.get("x-content-type-options"), "nosniff");
  });
});

test("API docs are not served in production", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api-docs/`, { redirect: "manual" });
    assert.strictEqual(response.status, 404);
  });
});
