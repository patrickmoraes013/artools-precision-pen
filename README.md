# Artools Precision Pen

Landing page premium para a Artools Pigmentum Precision Series 2025, com animações GSAP e scroll cinematográfico.

## Estrutura do Projeto

```
artools-precision-pen/
├── index.html              # Estrutura HTML
├── css/
│   └── styles.css          # Todo o CSS da página
├── js/
│   └── main.js             # Todo o JavaScript (GSAP, Lenis, lógica de scroll)
├── assets/
│   ├── images/
│   │   └── pen-closeup-portrait.jpg
│   ├── videos/             # Gitignored (arquivos grandes)
│   │   ├── pen-writing.mp4
│   │   └── artools-pigmentum.mp4
│   └── templates/          # Arquivos de referência/inspiração (não fazem parte do site)
├── .gitignore
└── README.md
```

## Tecnologias

| Biblioteca | Versão | Uso |
|---|---|---|
| GSAP | 3.12.5 | Animações de entrada e scroll |
| GSAP ScrollTrigger | 3.12.5 | Triggers de animação por scroll |
| Lenis | 1.0.42 | Smooth scroll |
| Google Fonts | — | Inter + JetBrains Mono |

## Como Executar Localmente

Não há dependências de build — basta servir os arquivos estáticos.

**Com VS Code Live Server:**
1. Abra a pasta no VS Code
2. Clique em "Go Live" na barra de status

**Com Python:**
```bash
python -m http.server 3000
```

**Com Node.js (npx):**
```bash
npx serve .
```

Acesse `http://localhost:3000` (ou a porta indicada).

## Observação sobre os Vídeos

Os arquivos `.mp4` em `assets/videos/` estão no `.gitignore` por serem arquivos grandes. Para deploy em produção, hospede os vídeos em um CDN (Cloudflare R2, AWS S3, Bunny.net) e atualize as referências em `index.html`.

## Seções da Página

| Seção | ID | Descrição |
|---|---|---|
| Hero | `#hero-scroll-section` | Vídeo com extração de frames por scroll |
| Tecnologia | `#tecnologia` | Engenharia e especificações técnicas |
| Experiência | `#escrita` | Vídeo showcase, stats e depoimentos |
| Adquirir | `#comprar` | Card cinematic com CTA principal |
