// Test harness: runs the calculator's own inline script with a minimal DOM shim,
// then checks the numbers against the worked example printed in the book (chapter 9)
// and against the shipping / platform-fee features added in this session.
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

// --- pull the inline script (must be the only <script> in the file)
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
if (scripts.length !== 1) {
  console.error(`FALHA: esperava 1 <script> inline, achei ${scripts.length}`);
  process.exit(1);
}
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// --- minimal DOM shim. Every node the page touches must be registered here,
//     otherwise getElementById returns a throwaway node and state is lost.
const FORM = ["peso","filamento","falha","tempo","impressora","vida","manut","horasmes",
              "watts","tarifa","minutos","hora","embalagem","frete","envio","plataforma",
              "comissao","fixo","imposto","margem","arred"];
const OUT = ["o_mat","o_maq","o_ene","o_tra","o_emb","o_frete","o_fixo","o_com","o_custo",
             "o_piso","o_preco","o_marg","o_desc","o_frac","o_aviso"];

function makeNode(id) {
  return { id, value: defaults[id] ?? "0", textContent: "", className: "", _handlers: [],
           addEventListener(_, fn) { this._handlers.push(fn); } };
}

const nodes = new Map([...FORM, ...OUT].map((id) => [id, makeNode(id)]));
globalThis.document = { getElementById: (id) => nodes.get(id) ?? makeNode(id) };

// --- run the shipped script
new Function(script)();

// --- helpers
const get  = (id) => nodes.get(id).textContent;
const val  = (id) => nodes.get(id).value;
const set  = (obj) => { for (const [k, v] of Object.entries(obj)) nodes.get(k).value = String(v); };
const fire = (id) => nodes.get(id)._handlers.forEach((fn) => fn());

let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(42)} obtido=${String(got).padEnd(10)} esperado=${want}`);
};
const checkTrue = (label, cond, detail = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? "  (" + detail + ")" : ""}`);
};

// --- 1) the book's chapter 9, set explicitly (not via form defaults, which may change)
const LIVRO = {
  peso: 24.36, filamento: 2500, falha: 15, tempo: 2.62, impressora: 68800,
  vida: 4000, manut: 700, horasmes: 100, watts: 150, tarifa: 32,
  minutos: 20, hora: 1000, embalagem: 100, frete: 0, fixo: 0,
  comissao: 10, imposto: 0, margem: 40, arred: 10,
};
set(LIVRO); fire("peso");

console.log("— Exemplo do livro (capítulo 9) —");
check("custo total",    get("o_custo"), "¥591");
check("preço sugerido", get("o_preco"), "¥1,190");
check("preço mínimo",   get("o_piso"),  "¥660");
check("material",       get("o_mat"),   "¥70");
check("máquina",        get("o_maq"),   "¥73");

// the book prints ¥1.190 for this exact piece — that is the one that must hold
if (get("o_preco") !== "¥1,190") {
  console.log(`\nFALHA CRÍTICA: o livro imprime ¥1.190 e a calculadora devolve ${get("o_preco")}`);
  process.exit(1);
}

// --- 2) failure rate hits machine + energy, never labour
console.log("\n— Regra da taxa de falha —");
const m0 = get("o_maq"), t0 = get("o_tra"), e0 = get("o_ene");
nodes.get("falha").value = "0"; fire("peso");
checkTrue("falha=0 altera a máquina", get("o_maq") !== m0, `${m0} -> ${get("o_maq")}`);
checkTrue("falha=0 altera a energia", get("o_ene") !== e0, `${e0} -> ${get("o_ene")}`);
checkTrue("falha=0 NÃO altera o trabalho", get("o_tra") === t0, t0);

// --- 3) frete entra no custo e NÃO leva multiplicador de falha
console.log("\n— Frete —");
set({ ...LIVRO, frete: 520 }); fire("peso");
check("frete na linha própria", get("o_frete"), "¥520");
check("material não muda com o frete", get("o_mat"), "¥70");
check("custo com frete 520", get("o_custo"), "¥1,111");
check("preço recalculado com frete", get("o_preco"), "¥2,230");

// seletor de envio preenche o campo
nodes.get("envio").value = "210"; fire("envio");
check("seletor ネコポス preenche ¥210", val("frete"), "210");
check("custo com ネコポス", get("o_custo"), "¥801");

// o frete alto é sinalizado
nodes.get("envio").value = "1700"; fire("envio");
checkTrue("frete > 20% do preço gera o aviso", get("o_frac").includes("viaja caro"), get("o_frac"));

// --- 4) presets de plataforma (taxas conferidas na fonte)
console.log("\n— Plataformas —");
set(LIVRO); fire("peso");
nodes.get("plataforma").value = "minne"; fire("plataforma");
check("minne define a comissão", val("comissao"), "10.659");
check("minne não tem taxa fixa",  val("fixo"), "0");

nodes.get("plataforma").value = "creema"; fire("plataforma");
check("Creema define a comissão", val("comissao"), "10.67");

nodes.get("plataforma").value = "yahoo"; fire("plataforma");
check("Yahoo!フリマ é 5%, não 10%", val("comissao"), "5");

nodes.get("plataforma").value = "booth"; fire("plataforma");
check("BOOTH define a comissão", val("comissao"), "5.6");
check("BOOTH define a taxa fixa", val("fixo"), "45");

nodes.get("plataforma").value = "mercari"; fire("plataforma");
check("Mercari volta para 10%", val("comissao"), "10");
checkTrue("Mercari avisa que não está verificado", get("o_aviso").includes("NÃO estão conferidos"), get("o_aviso").slice(0, 60));

// "outra" não apaga o que o usuário digitou
nodes.get("comissao").value = "7"; fire("comissao");
nodes.get("plataforma").value = "outro"; fire("plataforma");
check("plataforma 'outra' preserva a comissão digitada", val("comissao"), "7");

// --- 5) denominador estourado vira explicação, não número
console.log("\n— Guarda do denominador —");
set({ ...LIVRO, margem: 95, comissao: 10 }); fire("peso");
checkTrue("margem+comissão > 100% avisa", get("o_frac").includes("passam de 100"), get("o_frac"));
check("sem preço quando a conta não fecha", get("o_preco"), "—");

// --- 6) arredondamento sempre para cima, em múltiplos do passo
console.log("\n— Arredondamento —");
set({ ...LIVRO, arred: 50 }); fire("peso");
checkTrue("preço múltiplo de ¥50", Number(get("o_preco").replace(/[^\d]/g, "")) % 50 === 0, get("o_preco"));

// --- 7) a página publicada carrega as fontes e os guias
console.log("\n— Higiene da página publicada —");
checkTrue("sem requisição externa de CSS/JS",
  !/<link[^>]+rel="stylesheet"/i.test(html) &&
  !/<script[^>]+src=/i.test(html) &&
  !/@import|url\(\s*["']?https?:/i.test(html));
checkTrue("tem seção de fontes", html.includes("Fontes dos números desta página"));
checkTrue("tem canonical", html.includes('rel="canonical"'));
checkTrue("aponta para os 4 guias",
  ["taxas-de-venda","frete-de-peca-impressa","depreciacao-da-impressora","filamento-no-japao"]
    .every((s) => html.includes(`guia/${s}.html`)));

console.log(fail === 0 ? "\nTodos os testes passaram." : `\n${fail} teste(s) falharam.`);
process.exit(fail === 0 ? 0 : 1);
