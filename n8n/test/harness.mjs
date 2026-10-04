// Runs the code of an n8n Code node the way n8n does: as the body of an async function.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export const workflow = (file) => JSON.parse(fs.readFileSync(path.join(here, '..', file), 'utf8'));
export const nodeCode = (wf, name) => {
  const n = wf.nodes.find((x) => x.name === name);
  if (!n) throw new Error('no node ' + name);
  return n.parameters.jsCode;
};

// run(code, {json, sd, noCrypto, helpers, nodes}) -> the node's return value
export async function run(code, { json = {}, sd = {}, noCrypto = false, helpers = {}, nodes = {} } = {}) {
  const req = (m) => { if (m === 'crypto' && !noCrypto) return crypto; throw new Error('module not allowed: ' + m); };
  const $ = (name) => ({ first: () => ({ json: nodes[name] || {} }), isExecuted: false });
  const fn = new AsyncFunction('$json', '$getWorkflowStaticData', 'require', '$', '$input', code);
  const input = { first: () => ({ json }), all: () => [{ json }] };
  return fn.call({ helpers }, json, () => sd, req, $, input);
}

export function check(name, ok, extra) {
  if (!ok) { console.error('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); process.exitCode = 1; }
  else console.log('ok  ', name);
}
export { crypto };
