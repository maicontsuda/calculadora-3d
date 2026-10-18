// Test harness: runs the calculator's own inline script with a minimal DOM shim,
// then checks the numbers against the worked example printed in the book (chapter 9).
//
//   node test_calculadora.mjs
//
// It exercises the shipped file, not a copy of the formulas.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "index.html"), "utf8");

// --- pull the default values straight out of the form
const defaults = {};
for (const m of html.matchAll(/id="([a-z]+)"\s+value="([0-9.]+)"/g)) {
  defaults[m[1]] = m[2];
}

// --- pull the inline script
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// --- minimal DOM shim
const nodes = new Map();
function makeNode(id) {
  return { id, value: defaults[id] ?? "0", textContent: "", className: "", _handlers: [],
           addEventListener(_, fn) { this._handlers.push(fn); } };
}
for (const id of Object.keys(defaults)) nodes.set(id, makeNode(id));
for (const id of ["o_mat","o_maq","o_ene","o_tra","o_emb","o_com","o_custo",
                  "o_piso","o_preco","o_marg","o_desc","o_frac"]) {
  nodes.set(id, makeNode(id));
}

globalThis.document = { getElementById: (id) => nodes.get(id) ?? makeNode(id) };

// --- run the shipped script
new Function(script)();

// --- assertions against the book's chapter 9
const get = (id) => nodes.get(id).textContent;
const checks = [
  ["custo total",      get("o_custo"), "¥591"],
  ["preço sugerido",   get("o_preco"), "¥1,190"],
  ["preço mínimo",     get("o_piso"),  "¥660"],
  ["material",         get("o_mat"),   "¥70"],
  ["máquina",          get("o_maq"),   "¥73"],
];

let fail = 0;
for (const [label, got, want] of checks) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(16)} obtido=${got.padEnd(10)} esperado=${want}`);
}

// the book prints ¥1.190 for this exact piece — that is the one that must hold
const preco = get("o_preco");
if (preco !== "¥1,190") {
  console.log(`\nFALHA CRÍTICA: o livro imprime ¥1.190 e a calculadora devolve ${preco}`);
  process.exit(1);
}

// sanity: the failure rate must hit machine and energy, not labour.
// setting falha to 0 must lower the machine line but leave labour untouched.
const m0 = get("o_maq"), t0 = get("o_tra");
nodes.get("falha").value = "0";
nodes.get("peso")._handlers.forEach((fn) => fn());
const m1 = get("o_maq"), t1 = get("o_tra");
const maqMudou = m0 !== m1;
const traFixo = t0 === t1;
console.log(`${maqMudou ? "PASS" : "FAIL"}  falha=0 altera a máquina (${m0} -> ${m1})`);
console.log(`${traFixo ? "PASS" : "FAIL"}  falha=0 NÃO altera o trabalho (${t0})`);
if (!maqMudou || !traFixo) fail++;

// sanity: denominator guard
nodes.get("margem").value = "95";
nodes.get("comissao").value = "10";
nodes.get("peso")._handlers.forEach((fn) => fn());
const guard = get("o_frac");
const guardOk = guard.includes("passam de 100");
console.log(`${guardOk ? "PASS" : "FAIL"}  margem+comissão > 100% avisa em vez de mostrar travessão`);
if (!guardOk) fail++;

console.log(fail === 0 ? "\nTodos os testes passaram." : `\n${fail} teste(s) falharam.`);
process.exit(fail === 0 ? 0 : 1);
