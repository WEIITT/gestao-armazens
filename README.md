# Gestão de Armazéns

Aplicação web desenvolvida para gestão de armazéns, produtos, stock e movimentos logísticos.

A aplicação permite controlar entradas, saídas, transferências e inventário em diferentes armazéns, apresentando também alertas automáticos de reposição, histórico de movimentos e dashboard estatístico.

Os dados são armazenados localmente através do `localStorage`, não sendo necessário servidor ou base de dados externa.

---

# Funcionalidades

## Gestão de Armazéns

- Criar armazéns
- Editar armazéns
- Remover armazéns
- Bloqueio de remoção com stock associado

## Gestão de Produtos

- Criar produtos
- Editar produtos
- Remover produtos
- SKU / Código de barras
- Unidade de medida
- Nível mínimo de stock

## Gestão de Stock

- Controlo de stock por armazém
- Quantidades atualizadas em tempo real
- Alertas automáticos de reposição
- Filtros de stock

## Movimentos

- Entradas de stock
- Saídas de stock
- Ajustes de inventário
- Transferências entre armazéns
- Histórico automático de movimentos

## Funcionalidades Adicionais

- Pesquisa rápida de produtos
- Leitura de código de barras
- Scanner QR Code
- Exportação CSV/Excel
- Dashboard com gráficos
- Modo claro e escuro
- Sistema de login local
- Dados de exemplo

---

# Tecnologias Utilizadas

- React 19
- TypeScript
- Vite 8
- CSS
- localStorage
- html5-qrcode

---

# Requisitos

- Node.js 18 ou superior
- npm

---

# Instalação

## Clonar o repositório

```bash
git clone https://github.com/soficuor1/gestao-armazens.git
```

## Entrar na pasta do projeto

```bash
cd gestao-armazens
```

## Instalar dependências

```bash
npm install
```

## Executar a aplicação

```bash
npm run dev
```

## Abrir no navegador

```text
http://localhost:5173
```

---

# Build de Produção

## Gerar build

```bash
npm run build
```

## Pré-visualizar build

```bash
npm run preview
```

---

# Estrutura do Projeto

```text
gestao-armazens/
  public/
  src/
    assets/
    app.css
    App.tsx
    main.tsx
    store.tsx
    types.ts
    vite-env.d.ts
  .gitignore
  index.html
  package.json
  tsconfig.json
  vite.config.ts
```

---

# Estrutura da Aplicação

A aplicação encontra-se dividida em diferentes secções:

- Painel principal
- Gestão de armazéns
- Gestão de produtos
- Gestão de stock
- Gestão de movimentos
- Histórico
- Dashboard

---

# Regras de Negócio

O sistema implementa várias validações:

- Impedir stock negativo
- Impedir transferências inválidas
- Impedir origem igual ao destino
- Impedir remoção de produtos com stock
- Impedir remoção de armazéns com stock
- Validar quantidades inválidas

---

# Persistência dos Dados

Todos os dados são armazenados localmente através do `localStorage`.

Os dados permanecem guardados:

- após atualizar a página;
- após fechar o navegador;
- durante novas sessões locais.

---

# Login

A aplicação possui um sistema simples de autenticação local.

## Credenciais por defeito

```text
Utilizador: admin
Password: admin
```

---

# Exportação

A aplicação permite exportar os dados de stock em formato CSV, compatível com:

- Microsoft Excel
- Google Sheets
- LibreOffice Calc

---

# Scanner QR Code

A aplicação suporta leitura de QR Code através da câmara do dispositivo utilizando a biblioteca `html5-qrcode`.

---

# Melhorias Futuras

Funcionalidades planeadas para futuras versões:

- Backend/API REST
- Base de dados
- Multiutilizador
- Gestão de permissões
- Notificações
- Relatórios PDF
- Dashboard avançado
- Integração com APIs externas

---

