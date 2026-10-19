# Calculadora de Precificação — Impressão 3D no Japão

Ferramenta gratuita, sem cadastro. Calcula custo real, preço mínimo e preço sugerido
de uma peça impressa em 3D, em iene: material, depreciação da máquina, energia,
mão de obra, taxa de falha, embalagem, **frete**, **comissão da plataforma** e imposto.

Publicado em <https://maicontsuda.github.io/calculadora-3d/>.

## Estrutura do site

| Caminho | Conteúdo |
|---|---|
| `index.html` | A calculadora. Página única, sem dependência externa — funciona offline |
| `guia/taxas-de-venda.html` | Taxas de venda conferidas na fonte: minne, Creema, Yahoo!フリマ, BOOTH |
| `guia/frete-de-peca-impressa.html` | A regra do 3辺合計, ネコポス ¥210 vs コンパクト ¥520 |
| `guia/depreciacao-da-impressora.html` | Custo por hora da máquina (depreciação + manutenção) |
| `guia/filamento-no-japao.html` | Preços de filamento verificados loja por loja |
| `sitemap.xml`, `robots.txt` | Para os buscadores |

Cada página-guia usa `assets/estilo.css`. A calculadora tem CSS e JS embutidos de propósito
(é ela que precisa funcionar offline).

## Regra editorial

**Nenhum número sem fonte.** Taxa sem fonte oficial aparece marcada como não verificada —
é o caso da comissão do Mercari, cuja central de ajuda bloqueia acesso automático (HTTP 403).
Os links das fontes ficam no rodapé da calculadora e dentro de cada guia.

## Teste

```
node test_calculadora.mjs
```

Roda o **próprio `<script>` do index.html** com um DOM simulado e confere:

- o exemplo do livro (chega a **¥1.190**);
- a taxa de falha incide sobre máquina e energia, **não** sobre trabalho/embalagem/frete;
- o frete entra no custo sem multiplicador de falha;
- os presets de plataforma (minne 10,659% · Creema 10,67% · Yahoo!フリマ 5% · BOOTH 5,6% + ¥45);
- a guarda do denominador (margem + comissão + imposto > 100% avisa em vez de mostrar preço);
- arredondamento sempre para cima;
- a página não faz requisição externa de CSS/JS e linka os quatro guias.
