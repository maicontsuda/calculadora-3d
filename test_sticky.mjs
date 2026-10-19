// Teste de navegador: o painel do resultado (position:sticky) não pode cobrir nada
// ao rolar — em especial o bloco "Isto te ajudou?" (CTA).
//
//   node test_sticky.mjs                                    # testa o index.html local
//   node test_sticky.mjs https://maicontsuda.github.io/calculadora-3d/   # testa o site no ar
//
// Sobe um Chrome headless próprio (porta aleatória, perfil temporário), carrega a
// página e mede, a cada 150 px de rolagem, os retângulos do painel e do CTA.
// Falha se houver sobreposição ou se o painel nunca prender no topo.
//
// Requer o Google Chrome instalado. Não precisa de servidor.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CANDIDATOS = [
  process.env.CHROME,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const chrome = CANDIDATOS.find((p) => existsSync(p));
if (!chrome) {
  console.error("Chrome não encontrado. Defina a variável CHROME com o caminho do executável.");
  process.exit(2);
}

const arg = process.argv[2];
const alvo = arg
  ? (/^https?:/i.test(arg) ? arg : "file:///" + resolve(arg).replace(/\\/g, "/"))
  : "file:///" + resolve(import.meta.dirname, "index.html").replace(/\\/g, "/");
const perfil = mkdtempSync(join(tmpdir(), "calc-sticky-"));
const porta = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let processo;
const limpar = () => {
  try { processo?.kill("SIGKILL"); } catch {}
  try { rmSync(perfil, { recursive: true, force: true }); } catch {}
};
process.on("exit", limpar);

processo = spawn(chrome, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
  "--disable-extensions", "--disable-background-networking",
  `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, "about:blank",
], { stdio: "ignore" });

async function acharPagina() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json/list`);
      const lista = await r.json();
      const p = lista.find((t) => t.type === "page");
      if (p) return p;
    } catch {}
    await sleep(250);
  }
  throw new Error("o Chrome não abriu a porta de depuração");
}

const pagina = await acharPagina();
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pendentes = new Map();
const eventos = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pendentes.has(m.id)) {
    const { res, rej } = pendentes.get(m.id);
    pendentes.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  } else if (m.method) eventos.push(m.method);
};
const cmd = (method, params = {}) => new Promise((res, rej) => {
  const meu = ++id;
  pendentes.set(meu, { res, rej });
  ws.send(JSON.stringify({ id: meu, method, params }));
});

const MEDIR = `(async () => {
  const painel = document.querySelector('.out.sticky');
  const cta = document.querySelector('.cta.band');
  if (!painel) return { erro: '.out.sticky não existe' };
  if (!cta) return { erro: '.cta.band não existe' };
  const vh = window.innerHeight;
  const total = document.documentElement.scrollHeight;
  const linhas = [];
  for (let y = 0; y <= total; y += 150) {
    window.scrollTo(0, y);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const a = painel.getBoundingClientRect(), b = cta.getBoundingClientRect();
    const naTela = (r) => r.bottom > 0 && r.top < vh;
    linhas.push({
      scroll: Math.round(window.scrollY),
      topo: Math.round(a.top), base: Math.round(a.bottom),
      sobrepoe: naTela(a) && naTela(b) && a.bottom > b.top && a.top < b.bottom,
      preso: Math.abs(a.top - 16) <= 1,
      ctaNaTela: naTela(b),
    });
  }
  return { vh, linhas };
})()`;

await cmd("Page.enable");

let falhas = 0;
const check = (ok, msg) => { if (!ok) falhas++; console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); };

// três tamanhos: notebook, tela baixa e celular
for (const [nome, largura, altura, mobile] of [
  ["notebook 1200×900", 1200, 900, false],
  ["tela baixa 1200×620", 1200, 620, false],
  ["celular 390×844", 390, 844, true],
]) {
  await cmd("Emulation.setDeviceMetricsOverride", {
    width: largura, height: altura, deviceScaleFactor: 1, mobile,
  });
  await cmd("Page.navigate", { url: alvo });
  for (let i = 0; i < 40 && !eventos.includes("Page.loadEventFired"); i++) await sleep(200);
  await sleep(400);
  eventos.length = 0;

  const r = await cmd("Runtime.evaluate", { expression: MEDIR, awaitPromise: true, returnByValue: true });
  const dados = r.result?.value;
  if (!dados || dados.erro) { console.log(`FAIL  ${nome}: ${dados?.erro || "sem dados"}`); falhas++; continue; }

  const sobrepostas = dados.linhas.filter((l) => l.sobrepoe);
  const presas = dados.linhas.filter((l) => l.preso);
  const ctaVisivel = dados.linhas.filter((l) => l.ctaNaTela);

  check(sobrepostas.length === 0, `${nome} · o painel nunca cobre o CTA (${dados.linhas.length} posições)`);
  check(ctaVisivel.length > 0, `${nome} · o CTA aparece na tela em alguma posição`);
  if (largura >= 900) {
    check(presas.length > 0, `${nome} · o painel prende no topo (${presas.length} posições)`);
  }
  if (sobrepostas.length) console.log("      ex.:", JSON.stringify(sobrepostas[0]));
}

ws.close();
limpar();
console.log(falhas === 0 ? "\nSticky: tudo certo." : `\nSticky: ${falhas} problema(s).`);
process.exit(falhas === 0 ? 0 : 1);
