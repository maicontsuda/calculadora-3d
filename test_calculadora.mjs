// Test harness: runs the calculator's own inline script with a minimal DOM shim.
// Confere o exemplo do livro (capítulo 9) e as funções novas: frete, taxa fixa,
// presets de plataforma e o motor de países (Japão, Brasil, EUA).
//
//   node test_calculadora.mjs
//
// It exercises the shipped file, not a copy of the formulas.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "index.html"), "utf8");

// --- pull the default values straight out of the form (são os do Japão)
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
              "comissao","fixo","imposto","margem","arred","pais"];
const OUT = ["o_mat","o_maq","o_ene","o_tra","o_emb","o_frete","o_fixo","o_com","o_custo",
             "o_piso","o_preco","o_marg","o_desc","o_frac","o_aviso"];

function makeNode(id) {
  return { id, value: defaults[id] ?? "0", textContent: "", className: "", _handlers: [],
           addEventListener(_, fn) { this._handlers.push(fn); } };
}

const nodes = new Map([...FORM, ...OUT].map((id) => [id, makeNode(id)]));
globalThis.document = {
  getElementById: (id) => nodes.get(id) ?? makeNode(id),
  getElementsByClassName: () => [],
};

// --- run the shipped script
new Function(script)();

// --- helpers
const get  = (id) => nodes.get(id).textContent;
const val  = (id) => nodes.get(id).value;
const set  = (obj) => { for (const [k, v] of Object.entries(obj)) nodes.get(k).value = String(v); };
const fire = (id) => nodes.get(id)._handlers.forEach((fn) => fn());
const irPara = (pais) => { nodes.get("pais").value = pais; fire("pais"); };

let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(44)} obtido=${String(got).padEnd(12)} esperado=${want}`);
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
irPara("jp");
set(LIVRO); fire("peso");

console.log("— Japão: exemplo do livro (capítulo 9) —");
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
console.log("\n— Japão: frete —");
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
console.log("\n— Japão: plataformas —");
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
checkTrue("Mercari avisa que não está verificado", get("o_aviso").includes("NÃO estão conferidos"));

// "outra" não apaga o que o usuário digitou
nodes.get("comissao").value = "7"; fire("comissao");
nodes.get("plataforma").value = "outro"; fire("plataforma");
check("plataforma 'outra' preserva a comissão digitada", val("comissao"), "7");

// --- 5) denominador estourado vira explicação, não número
console.log("\n— Guarda do denominador —");
set({ ...LIVRO, margem: 95, comissao: 10 }); fire("peso");
checkTrue("margem+comissão > 100% avisa", get("o_frac").includes("passam de 100"));
check("sem preço quando a conta não fecha", get("o_preco"), "—");

// --- 6) arredondamento sempre para cima, em múltiplos do passo
console.log("\n— Arredondamento —");
set({ ...LIVRO, arred: 50 }); fire("peso");
checkTrue("preço múltiplo de ¥50", Number(get("o_preco").replace(/[^\d]/g, "")) % 50 === 0, get("o_preco"));

// --- 7) motor de países
console.log("\n— Brasil —");
nodes.get("peso").value = "77"; fire("peso");   // edição do usuário que deve sobreviver à troca
irPara("br");
check("peso padrão do Brasil",   val("peso"), "30");
check("filamento padrão (R$/kg)", val("filamento"), "120");
check("tarifa padrão (R$/kWh)",  val("tarifa"), "0.95");
check("custo total em reais",    get("o_custo"), "R$ 35,48");
check("preço mínimo em reais",   get("o_piso"),  "R$ 36,00");
check("preço sugerido em reais", get("o_preco"), "R$ 60,00");
check("margem real",             get("o_marg"),  "40.9%");

nodes.get("plataforma").value = "shopee"; fire("plataforma");
check("Shopee traz a taxa fixa oficial", val("fixo"), "4.5");
checkTrue("Shopee avisa que o percentual não foi conferido", get("o_aviso").includes("NÃO foi conferido"));

nodes.get("plataforma").value = "mercadolivre"; fire("plataforma");
check("Mercado Livre define a comissão", val("comissao"), "14");
checkTrue("Mercado Livre traz o aviso", get("o_aviso").includes("Mercado Livre"));

console.log("\n— Estados Unidos —");
irPara("us");
check("peso padrão dos EUA",       val("peso"), "30");
check("filamento padrão (US$/kg)", val("filamento"), "25");
check("energia: média oficial da EIA", val("tarifa"), "0.183");
check("custo total em dólar",      get("o_custo"), "US$ 15,15");
check("preço mínimo em dólar",     get("o_piso"),  "US$ 16,00");
check("preço sugerido em dólar",   get("o_preco"), "US$ 26,00");
check("margem real",               get("o_marg"),  "41.7%");

nodes.get("plataforma").value = "etsy"; fire("plataforma");
check("Etsy define a comissão", val("comissao"), "9.5");
check("Etsy define a taxa fixa", val("fixo"), "0.45");

console.log("\n— Voltar para o Japão restaura o que foi digitado —");
irPara("jp");
check("peso editado pelo usuário restaurado", val("peso"), "77");
check("arredondamento restaurado", val("arred"), "50");
check("comissão restaurada", val("comissao"), "10");
checkTrue("resultado volta em iene", get("o_preco").startsWith("¥"), get("o_preco"));

// --- 8) a página publicada carrega as fontes e os guias
console.log("\n— Higiene da página publicada —");
checkTrue("sem requisição externa de CSS/JS",
  !/<link[^>]+rel="stylesheet"/i.test(html) &&
  !/<script[^>]+src=/i.test(html) &&
  !/@import|url\(\s*["']?https?:/i.test(html));
checkTrue("tem seção de fontes", html.includes("Fontes dos números desta página"));
checkTrue("tem canonical", html.includes('rel="canonical"'));
checkTrue("tem os três países no seletor",
  ["jp","br","us"].every((p) => html.includes(`value="${p}"`)));
checkTrue("tem blocos de fonte por país",
  ["jp","br","us"].every((p) => html.includes(`id="fontes-${p}"`)));
checkTrue("tem teste de sticky", html.includes("row_envio"));
// o CTA já foi parar embaixo do painel sticky uma vez: ele tem que ficar FORA da grade
checkTrue("CTA em banda própria, fora da coluna do resultado",
  html.includes('class="cta band"') && html.includes('class="aside"') && !html.includes('<div class="cta">'));
checkTrue("aponta para os 4 guias",
  ["taxas-de-venda","frete-de-peca-impressa","depreciacao-da-impressora","filamento-no-japao"]
    .every((s) => html.includes(`guia/${s}.html`)));

console.log(fail === 0 ? "\nTodos os testes passaram." : `\n${fail} teste(s) falharam.`);
process.exit(fail === 0 ? 0 : 1);
