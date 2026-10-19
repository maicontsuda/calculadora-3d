# Calculadora de Precificação — Impressão 3D (Japão, Brasil e EUA)

Ferramenta gratuita, sem cadastro. Calcula custo real, preço mínimo e preço sugerido
de uma peça impressa em 3D, **na moeda do país escolhido**: material, depreciação da máquina,
energia, mão de obra, taxa de falha, embalagem, **frete**, **comissão da plataforma** e imposto.

Países: **Japão (¥)**, **Brasil (R$)** e **Estados Unidos (US$)** — cada um com parâmetros,
plataformas, regra de envio e bloco de fontes próprios. Trocar de país não perde o que você digitou.

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

## Teste de layout no navegador

```
node test_sticky.mjs                                    # index.html local
node test_sticky.mjs https://maicontsuda.github.io/calculadora-3d/   # site no ar
```

Sobe um Chrome headless, rola a página a cada 150 px e mede o painel do resultado contra o
bloco "Isto te ajudou?" em três tamanhos de tela. Existe porque o `position:sticky` do painel
cobria o CTA — e para que esse bug não volte.
