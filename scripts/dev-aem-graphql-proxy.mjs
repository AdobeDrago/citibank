/**
 * Local-only GraphQL CORS proxy for EDS CF development.
 *
 * Bypasses missing Access-Control-Allow-Origin on Drago publish by forwarding
 * browser POSTs from localhost:3000 through this process.
 *
 * Usage (separate terminal from `aem up`):
 *   node scripts/dev-aem-graphql-proxy.mjs
 *
 * Then open:
 *   http://localhost:3000/credit-cards/content-fragment-demo?aemOrigin=http://localhost:4503
 *
 * Do not use in production or against untrusted origins.
 */

import http from 'node:http';
import https from 'node:https';

const LISTEN_PORT = Number(process.env.AEM_GQL_PROXY_PORT || 4503);
const TARGET_ORIGIN = process.env.AEM_GQL_PROXY_TARGET
  || 'https://publish-p199056-e2062160.adobeaemcloud.com';

const target = new URL(TARGET_ORIGIN);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'text/plain' });
    res.end('Method not allowed');
    return;
  }

  try {
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    const headers = {
      accept: 'application/json',
      host: target.host,
    };
    if (body?.length) {
      headers['content-type'] = req.headers['content-type'] || 'application/json';
      headers['content-length'] = String(body.length);
    }

    const upstream = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: req.url,
        method: req.method,
        headers,
      },
      (upRes) => {
        if (res.headersSent) return;
        res.writeHead(upRes.statusCode || 502, {
          'content-type': upRes.headers['content-type'] || 'application/json',
        });
        upRes.pipe(res);
      },
    );

    upstream.on('error', (err) => {
      if (res.headersSent) {
        res.destroy(err);
        return;
      }
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ errors: [{ message: err.message }] }));
    });

    req.on('error', () => {
      upstream.destroy();
    });
    res.on('close', () => {
      if (!res.writableEnded) upstream.destroy();
    });

    if (body?.length) upstream.write(body);
    upstream.end();
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ errors: [{ message: err.message }] }));
  }
});

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`AEM GraphQL CORS proxy → ${TARGET_ORIGIN}`);
  // eslint-disable-next-line no-console
  console.log(`Listening on http://127.0.0.1:${LISTEN_PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Open demo with ?aemOrigin=http://localhost:${LISTEN_PORT}`);
});
