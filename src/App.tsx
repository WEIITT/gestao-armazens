  import { useMemo, useState, useEffect } from "react";
  import type { Movement, MovementKind, Product, Warehouse } from "./types";
  import { stockKey } from "./types";
  import { useStore } from "./store.tsx";
  import { Html5QrcodeScanner } from "html5-qrcode";

  type View = "painel" | "armazens" | "produtos" | "stock" | "movimentos";

  const VIEW_META: Record<View, { title: string; lead: string }> = {
    painel: {
      title: "Painel",
      lead: "Resumo de armazéns, produtos e alertas de reposição.",
    },
    armazens: {
      title: "Armazéns",
      lead: "Cadastro de locais. Não é possível remover se existir stock.",
    },
    produtos: {
      title: "Produtos",
      lead: "SKU, unidade e quantidade mínima para alertas.",
    },
    stock: {
      title: "Stock",
      lead: "Quantidades por armazém e produto.",
    },
    movimentos: {
      title: "Movimentos",
      lead: "Entradas, saídas, ajustes e transferências.",
    },
  };

  const NAV: { id: View; label: string }[] = [
    { id: "painel", label: "Painel" },
    { id: "armazens", label: "Armazéns" },
    { id: "produtos", label: "Produtos" },
    { id: "stock", label: "Stock" },
    { id: "movimentos", label: "Movimentos" },
  ];

  function NavIcon({ id }: { id: View }) {
    const common = {
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.75,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
    };
    switch (id) {
      case "painel":
        return (
          <svg {...common}>
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
        );
      case "armazens":
        return (
          <svg {...common}>
            <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
            <path d="M9 21V12h6v9" />
          </svg>
        );
      case "produtos":
        return (
          <svg {...common}>
            <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
            <path d="M12 3v18M3.5 8.5 12 13l8.5-4.5" />
          </svg>
        );
      case "stock":
        return (
          <svg {...common}>
            <path d="M4 7h16M4 12h16M4 17h10" />
          </svg>
        );
      case "movimentos":
        return (
          <svg {...common}>
            <path d="M7 7h10M7 12h6M7 17h8" />
            <path d="M17 12l3 3-3 3" />
          </svg>
        );
    }
  }

  function PageHeader({ title, lead }: { title: string; lead: string }) {
    return (
      <header className="page-head">
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
      </header>
    );
  }

  function StatCard({
    label,
    value,
    warn,
  }: {
    label: string;
    value: number | string;
    warn?: boolean;
  }) {
    return (
      <div className={`stat-card ${warn ? "warn-stat" : ""}`}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
    );
  }

  function movementSummary(
    m: Movement,
    products: Product[],
    warehouses: Warehouse[],
  ): string {
    const prod = products.find((p) => p.id === m.productId);
    const pname = prod?.name ?? m.productId.slice(0, 8);
    const wname = (id?: string) =>
      warehouses.find((w) => w.id === id)?.name ?? "—";
    switch (m.kind) {
      case "entrada":
        return `${pname} → ${wname(m.warehouseId)} (+${m.quantity})`;
      case "saida":
        return `${pname} ← ${wname(m.warehouseId)} (−${m.quantity})`;
      case "ajuste":
        return `${pname} @ ${wname(m.warehouseId)} (= ${m.quantity})`;
      case "transferencia":
        return `${pname}: ${wname(m.fromWarehouseId)} → ${wname(m.toWarehouseId)}`;
      default:
        return m.kind;
    }
  }

  function downloadCsv(filename: string, rows: string[][]) {
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(";")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  export default function App() {
    const {
      state,
      addWarehouse,
      updateWarehouse,
      deleteWarehouse,
      addProduct,
      updateProduct,
      deleteProduct,
      registerMovement,
      getQty,
      seedDemo,
      resetAll,
    } = useStore();

    const [view, setView] = useState<View>("painel");
    const [banner, setBanner] = useState<string | null>(null);
    const [loggedIn, setLoggedIn] = useState(
      localStorage.getItem("auth") === "true"
    );
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const showBanner = (msg: string) => {
      setBanner(msg);
      window.setTimeout(() => setBanner(null), 4200);
    };

    const login = (e: React.FormEvent) => {
      e.preventDefault();

      if (username === "admin" && password === "admin") {
        localStorage.setItem("auth", "true");
        setLoggedIn(true);
      } else {
        showBanner("Credenciais inválidas.");
      }
    };

    const logout = () => {
      localStorage.removeItem("auth");
      setLoggedIn(false);
    };

    const exportStock = () => {
      const rows = [
        ["Produto", "SKU", "Armazém", "Quantidade"],
        ...state.products.flatMap((p) =>
          state.warehouses.map((w) => [
            p.name,
            p.sku,
            w.name,
            String(getQty(w.id, p.id)),
          ])
        ),
      ];

      downloadCsv("stock.csv", rows);
    };

    const lowStockRows = useMemo(() => {
      const rows: {
        warehouse: Warehouse;
        product: Product;
        qty: number;
      }[] = [];
      for (const w of state.warehouses) {
        for (const p of state.products) {
          const qty = getQty(w.id, p.id);
          if (qty > 0 && qty < p.reorderLevel) {
            rows.push({ warehouse: w, product: p, qty });
          }
        }
      }
      return rows;
    }, [state.warehouses, state.products, getQty]);

    const totalSkuPositions = useMemo(() => {
      return Object.values(state.stock).filter((q) => q > 0).length;
    }, [state.stock]);

    const totalUnits = useMemo(() => {
      return Object.values(state.stock).reduce((a, b) => a + b, 0);
    }, [state.stock]);

    const hasData =
      state.warehouses.length > 0 || state.products.length > 0;
    const meta = VIEW_META[view];

    if (!loggedIn) {
      return (
        <main className="login-page">
          <form className="card login-card" onSubmit={login}>
            <h1>Gestão de Armazéns</h1>
            <p className="muted">Iniciar sessão para aceder à aplicação.</p>

            <label className="field">
              <span>Utilizador</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </label>

            <label className="field">
              <span>Palavra-passe</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="admin"
              />
            </label>

            <button className="btn primary" type="submit">
              Entrar
            </button>
          </form>
        </main>
      );
    }

    return (
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </span>
            <div>
              <div className="brand-title">Armazéns</div>
              <div className="brand-sub">Gestão de stock</div>
            </div>
          </div>

          <nav className="nav">
            {NAV.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`nav-btn ${view === id ? "active" : ""}`}
                onClick={() => setView(id)}
              >
                <NavIcon id={id} />
                {label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button type="button" className="btn ghost small" onClick={seedDemo}>
              Carregar exemplo
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={exportStock}
            >
              Exportar stock
            </button>
            <button type="button" className="btn ghost small" onClick={logout}>
              Terminar sessão
            </button>
            <button
              type="button"
              className="btn danger ghost small"
              onClick={() => {
                if (
                  window.confirm(
                    "Limpar todos os dados guardados neste navegador?",
                  )
                ) {
                  resetAll();
                  showBanner("Dados repostos ao estado vazio.");
                }
              }}
            >
              Limpar dados
            </button>
          </div>
        </aside>

        <main className="main">
          <div className="main-content">
            {banner ? <div className="banner">{banner}</div> : null}

            {view !== "painel" ? (
              <PageHeader title={meta.title} lead={meta.lead} />
            ) : null}

          {view === "painel" ? (
            <section className="panel fade-in">
              <PageHeader title={meta.title} lead={meta.lead} />

              {!hasData ? (
                <div className="card empty-cta">
                  <div>
                    <h2 className="empty-cta-title">Sem dados</h2>
                    <p className="empty-cta-text">
                      Os dados ficam guardados neste navegador. Pode criar armazéns
                      e produtos manualmente, ou carregar um conjunto de exemplo
                      para experimentar a aplicação.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      seedDemo();
                      showBanner("Dados de exemplo carregados.");
                    }}
                  >
                    Carregar exemplo
                  </button>
                </div>
              ) : null}

              {hasData ? (
                <div className="stat-grid">
                  <StatCard label="Armazéns" value={state.warehouses.length} />
                  <StatCard label="Produtos" value={state.products.length} />
                  <StatCard
                    label="Posições com stock"
                    value={totalSkuPositions}
                  />
                  <StatCard
                    label="Alertas"
                    value={lowStockRows.length}
                    warn={lowStockRows.length > 0}
                  />
                  <StatCard
                    label="Unidades totais"
                    value={totalUnits.toLocaleString("pt-PT")}
                  />
                </div>
              ) : null}

              {hasData ? (
                <div className="card">
                  <div className="card-head">
                    <h2>Stock por produto</h2>
                  </div>

                  <div className="chart-list">
                    {state.products.map((p) => {
                      const total = state.warehouses.reduce(
                        (sum, w) => sum + getQty(w.id, p.id),
                        0
                      );

                      const max = Math.max(totalUnits, 1);
                      const width = Math.min((total / max) * 100, 100);

                      return (
                        <div className="chart-row" key={p.id}>
                          <div className="chart-label">
                            <span>{p.name}</span>
                            <strong>{total}</strong>
                          </div>
                          <div className="chart-bar">
                            <span style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {hasData ? (
                <div className="dashboard-cols">
                  <div className="card">
                    <div className="card-head">
                      <h2>Alertas de reposição</h2>
                      <span
                        className={`pill ${lowStockRows.length ? "warn" : "ok"}`}
                      >
                        {lowStockRows.length
                          ? `${lowStockRows.length} alertas`
                          : "Nenhum"}
                      </span>
                    </div>
                    {lowStockRows.length === 0 ? (
                      <p className="muted pad">
                        Sem alertas: todas as posições estão em quantidade igual ou
                        superior ao mínimo definido por produto.
                      </p>
                    ) : (
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Armazém</th>
                              <th>Produto</th>
                              <th>SKU</th>
                              <th className="num">Stock</th>
                              <th className="num">Mínimo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lowStockRows.map(({ warehouse, product, qty }) => (
                              <tr key={stockKey(warehouse.id, product.id)}>
                                <td className="strong">{warehouse.name}</td>
                                <td>{product.name}</td>
                                <td className="mono">{product.sku}</td>
                                <td className="num strong warn">{qty}</td>
                                <td className="num muted">
                                  {product.reorderLevel}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="card">
                    <div className="card-head">
                      <h2>Últimos movimentos</h2>
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => setView("movimentos")}
                      >
                        Ver tudo
                      </button>
                    </div>
                    <ul className="timeline">
                      {state.movements.length === 0 ? (
                        <li className="muted pad">Sem movimentos registados.</li>
                      ) : (
                        state.movements.slice(0, 6).map((m) => (
                          <li key={m.id} className="timeline-item">
                            <div className="timeline-dot" />
                            <div>
                              <div className="timeline-title">
                                {movementSummary(
                                  m,
                                  state.products,
                                  state.warehouses,
                                )}
                              </div>
                              <div className="timeline-meta muted">
                                {new Date(m.at).toLocaleString("pt-PT")}
                                {m.note ? ` · ${m.note}` : ""}
                              </div>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {view === "armazens" ? (
            <WarehousesView
              warehouses={state.warehouses}
              stock={state.stock}
              onAdd={addWarehouse}
              onUpdate={updateWarehouse}
              onDelete={(id) => {
                const ok = deleteWarehouse(id);
                if (!ok) {
                  showBanner(
                    "Não é possível remover armazém com stock positivo.",
                  );
                }
              }}
            />
          ) : null}

          {view === "produtos" ? (
            <ProductsView
              products={state.products}
              stock={state.stock}
              onAdd={addProduct}
              onUpdate={updateProduct}
              onDelete={(id) => {
                const ok = deleteProduct(id);
                if (!ok) {
                  showBanner(
                    "Não é possível remover produto com stock positivo.",
                  );
                }
              }}
            />
          ) : null}

          {view === "stock" ? (
            <StockView
              warehouses={state.warehouses}
              products={state.products}
              getQty={getQty}
            />
          ) : null}

          {view === "movimentos" ? (
            <MovementsView
              movements={state.movements}
              warehouses={state.warehouses}
              products={state.products}
              registerMovement={(payload) => {
                const ok = registerMovement(payload);
                if (!ok) {
                  showBanner(
                    "Movimento inválido: verifique quantidade e armazéns.",
                  );
                } else {
                  showBanner("Movimento registado.");
                }
              }}
            />
          ) : null}
          </div>
        </main>
      </div>
    );
  }

  function WarehousesView({
    warehouses,
    stock,
    onAdd,
    onUpdate,
    onDelete,
  }: {
    warehouses: Warehouse[];
    stock: Record<string, number>;
    onAdd: (w: Omit<Warehouse, "id">) => void;
    onUpdate: (w: Warehouse) => void;
    onDelete: (id: string) => void;
  }) {
    const [name, setName] = useState("");
    const [location, setLocation] = useState("");
    const [editing, setEditing] = useState<Warehouse | null>(null);

    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      const n = name.trim();
      const l = location.trim();
      if (!n) return;
      if (editing) {
        onUpdate({ ...editing, name: n, location: l });
        setEditing(null);
      } else {
        onAdd({ name: n, location: l });
      }
      setName("");
      setLocation("");
    };

    const stockFor = (id: string) =>
      Object.entries(stock).filter(([k, q]) => k.startsWith(`${id}:`) && q > 0)
        .length;

    return (
      <section className="panel fade-in">
        <div className="grid-2">
          <form className="card form-card" onSubmit={submit}>
            <h2>{editing ? "Editar armazém" : "Novo armazém"}</h2>
            <label className="field">
              <span>Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Armazém Central"
                required
              />
            </label>
            <label className="field">
              <span>Localização</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Cidade ou morada"
              />
            </label>
            <div className="row">
              <button type="submit" className="btn primary">
                {editing ? "Guardar" : "Adicionar"}
              </button>
              {editing ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setEditing(null);
                    setName("");
                    setLocation("");
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          <div className="card">
            <div className="card-head">
              <h2>Lista</h2>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Local</th>
                    <th className="num">Refs stock</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {warehouses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted pad">
                        Sem armazéns. Adicione o primeiro ao lado.
                      </td>
                    </tr>
                  ) : (
                    warehouses.map((w) => (
                      <tr key={w.id}>
                        <td className="strong">{w.name}</td>
                        <td>{w.location || "—"}</td>
                        <td className="num">{stockFor(w.id)}</td>
                        <td className="actions">
                          <button
                            type="button"
                            className="btn ghost small"
                            onClick={() => {
                              setEditing(w);
                              setName(w.name);
                              setLocation(w.location);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn danger ghost small"
                            onClick={() => onDelete(w.id)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function ProductsView({
    products,
    stock,
    onAdd,
    onUpdate,
    onDelete,
  }: {
    products: Product[];
    stock: Record<string, number>;
    onAdd: (p: Omit<Product, "id">) => void;
    onUpdate: (p: Product) => void;
    onDelete: (id: string) => void;
  }) {
    const [sku, setSku] = useState("");
    const [name, setName] = useState("");
    const [unit, setUnit] = useState("un");
    const [reorderLevel, setReorderLevel] = useState(10);
    const [editing, setEditing] = useState<Product | null>(null);
    const [search, setSearch] = useState("");

    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      const s = sku.trim();
      const n = name.trim();
      if (!s || !n) return;
      const rl = Math.max(0, Math.floor(Number(reorderLevel)));
      if (editing) {
        onUpdate({ ...editing, sku: s, name: n, unit: unit.trim() || "un", reorderLevel: rl });
        setEditing(null);
      } else {
        onAdd({ sku: s, name: n, unit: unit.trim() || "un", reorderLevel: rl });
      }
      setSku("");
      setName("");
      setUnit("un");
      setReorderLevel(10);
    };

    const refsFor = (productId: string) =>
      Object.entries(stock).filter(([k, q]) => k.endsWith(`:${productId}`) && q > 0)
        .length;

    const filteredProducts = products.filter((p) => {
      const term = search.trim().toLowerCase();

      return (
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.unit.toLowerCase().includes(term)
      );
    });

    return (
      <section className="panel fade-in">
        <div className="grid-2">
          <form className="card form-card" onSubmit={submit}>
            <h2>{editing ? "Editar produto" : "Novo produto"}</h2>
            <label className="field">
              <span>SKU</span>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Ex.: SKU-100"
                required
              />
            </label>
            <label className="field">
              <span>Nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Descrição curta"
                required
              />
            </label>
            <div className="row gap">
              <label className="field grow">
                <span>Unidade</span>
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="un, kg, cx..."
                />
              </label>
              <label className="field grow">
                <span>Mínimo (alerta)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="row">
              <button type="submit" className="btn primary">
                {editing ? "Guardar" : "Adicionar"}
              </button>
              {editing ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setEditing(null);
                    setSku("");
                    setName("");
                    setUnit("un");
                    setReorderLevel(10);
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          <div className="card">
            <div className="card-head">
              <h2>Lista</h2>
            </div>
            <label className="field">
              <span>Pesquisa rápida</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome, SKU ou unidade"
              />
            </label>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Nome</th>
                    <th>Un.</th>
                    <th className="num">Mín.</th>
                    <th className="num">Refs</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted pad">
                        Sem produtos. Registe SKUs para movimentar stock.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.id}>
                        <td className="mono">{p.sku}</td>
                        <td className="strong">{p.name}</td>
                        <td>{p.unit}</td>
                        <td className="num">{p.reorderLevel}</td>
                        <td className="num">{refsFor(p.id)}</td>
                        <td className="actions">
                          <button
                            type="button"
                            className="btn ghost small"
                            onClick={() => {
                              setEditing(p);
                              setSku(p.sku);
                              setName(p.name);
                              setUnit(p.unit);
                              setReorderLevel(p.reorderLevel);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn danger ghost small"
                            onClick={() => onDelete(p.id)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function StockView({
    warehouses,
    products,
    getQty,
  }: {
    warehouses: Warehouse[];
    products: Product[];
    getQty: (w: string, p: string) => number;
  }) {
    const [stockFilter, setStockFilter] = useState("todos");

    const filteredProducts = products.filter((p) => {
      if (stockFilter === "todos") return true;

      const total = warehouses.reduce(
        (sum, w) => sum + getQty(w.id, p.id),
        0
      );

      if (stockFilter === "com-stock") return total > 0;
      if (stockFilter === "sem-stock") return total === 0;

      return true;
    });

    if (warehouses.length === 0 || products.length === 0) {
      return (
        <section className="panel fade-in">
          <div className="card pad">
            <p className="muted">
              Crie pelo menos um armazém e um produto para visualizar a matriz de
              stock.
            </p>
          </div>
        </section>
      );
    }

    return (
      <section className="panel fade-in">
        <label className="field">
          <span>Filtrar stock</span>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="com-stock">Com stock</option>
            <option value="sem-stock">Sem stock</option>
          </select>
        </label>
        <div className="card table-wrap scroll-x">
          <table className="table matrix">
            <thead>
              <tr>
                <th className="sticky-col">Produto / SKU</th>
                {warehouses.map((w) => (
                  <th key={w.id} className="num">
                    <div>{w.name}</div>
                    <div className="th-sub muted">{w.location}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.id}>
                  <td className="sticky-col strong">
                    {p.name}
                    <div className="mono muted small">{p.sku}</div>
                  </td>
                  {warehouses.map((w) => {
                    const q = getQty(w.id, p.id);
                    return (
                      <td key={w.id} className={`num ${q < p.reorderLevel && q > 0 ? "warn" : ""} ${q === 0 ? "muted" : ""}`}>
                        {q === 0 ? "—" : `${q} ${p.unit}`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function MovementsView({
    movements,
    warehouses,
    products,
    registerMovement,
  }: {
    movements: import("./types").Movement[];
    warehouses: Warehouse[];
    products: Product[];
    registerMovement: (p: {
      kind: MovementKind;
      productId: string;
      quantity: number;
      warehouseId?: string;
      fromWarehouseId?: string;
      toWarehouseId?: string;
      note?: string;
    }) => void;
  }) {
    const [kind, setKind] = useState<MovementKind>("entrada");
    const [productId, setProductId] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [warehouseId, setWarehouseId] = useState("");
    const [fromId, setFromId] = useState("");
    const [toId, setToId] = useState("");
    const [note, setNote] = useState("");
    const [barcode, setBarcode] = useState("");
    const [barcodeStatus, setBarcodeStatus] = useState("");
    const [scannerOpen, setScannerOpen] = useState(false);

    const findProductByBarcode = (code: string) => {
      const cleanCode = code.trim().toLowerCase();

      if (!cleanCode) {
        setBarcodeStatus("");
        return;
      }

      const found = products.find(
        (p) => p.sku.trim().toLowerCase() === cleanCode
      );

      if (found) {
        setProductId(found.id);
        setBarcodeStatus(`Produto encontrado: ${found.name}`);
      } else {
        setBarcodeStatus("Produto não encontrado.");
      }
    };

    useEffect(() => {
      if (!scannerOpen) return;

      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: 250,
        },
        false
      );

      scanner.render(
        (decodedText) => {
          setBarcode(decodedText);
          findProductByBarcode(decodedText);
          scanner.clear();
          setScannerOpen(false);
        },
        () => {}
      );

      return () => {
        scanner.clear().catch(() => {});
      };
    }, [scannerOpen]);

    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      const q = Math.floor(Number(quantity));
      if (!productId || q <= 0) return;
      if (kind === "entrada" || kind === "saida" || kind === "ajuste") {
        if (!warehouseId) return;
        registerMovement({
          kind,
          productId,
          quantity: q,
          warehouseId,
          note: note.trim() || undefined,
        });
      } else {
        if (!fromId || !toId) return;
        registerMovement({
          kind: "transferencia",
          productId,
          quantity: q,
          fromWarehouseId: fromId,
          toWarehouseId: toId,
          note: note.trim() || undefined,
        });
      }
      setQuantity(1);
      setNote("");
      setBarcode("");
      setBarcodeStatus("");
    };

    const labelMovement = (m: import("./types").Movement) => {
      const prod = products.find((p) => p.id === m.productId);
      const pname = prod?.name ?? m.productId.slice(0, 8);
      const wname = (id?: string) =>
        warehouses.find((w) => w.id === id)?.name ?? "—";
      switch (m.kind) {
        case "entrada":
          return `Entrada · ${pname} → ${wname(m.warehouseId)} (+${m.quantity})`;
        case "saida":
          return `Saída · ${pname} ← ${wname(m.warehouseId)} (−${m.quantity})`;
        case "ajuste":
          return `Ajuste · ${pname} @ ${wname(m.warehouseId)} (= ${m.quantity})`;
        case "transferencia":
          return `Transferência · ${pname} ${wname(m.fromWarehouseId)} → ${wname(m.toWarehouseId)} (${m.quantity})`;
        default:
          return m.kind;
      }
    };

    const kindLabel: Record<MovementKind, string> = {
      entrada: "Entrada",
      saida: "Saída",
      ajuste: "Ajuste de inventário",
      transferencia: "Transferência",
    };

    return (
      <section className="panel fade-in">
        <div className="grid-2">
          <form className="card form-card" onSubmit={submit}>
            <h2>Novo movimento</h2>

            <label className="field">
              <span>Tipo</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as MovementKind)}
              >
                {(Object.keys(kindLabel) as MovementKind[]).map((k) => (
                  <option key={k} value={k}>
                    {kindLabel[k]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Código de barras / SKU</span>
              <div className="row">
                <input
                  value={barcode}
                  onChange={(e) => {
                    const value = e.target.value;
                    setBarcode(value);
                    findProductByBarcode(value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      findProductByBarcode(barcode);
                    }
                  }}
                  placeholder="Ler código de barras ou introduzir SKU"
                  className="grow"
                />
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setScannerOpen(true)}
                >
                  Ler QR Code
                </button>
              </div>
            </label>

            {scannerOpen ? <div id="qr-reader" className="qr-reader" /> : null}

            {barcodeStatus ? <p className="hint">{barcodeStatus}</p> : null}

            <label className="field">
              <span>Produto</span>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
              >
                <option value="">Selecionar…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Quantidade</span>
              <input
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </label>

            {kind === "transferencia" ? (
              <div className="row gap wrap">
                <label className="field grow">
                  <span>Origem</span>
                  <select
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    required
                  >
                    <option value="">Armazém…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field grow">
                  <span>Destino</span>
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    required
                  >
                    <option value="">Armazém…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="field">
                <span>Armazém</span>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  required
                >
                  <option value="">Selecionar…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {kind === "ajuste" ? (
              <p className="hint">
                O ajuste define o stock absoluto deste produto neste armazém (não
                soma nem subtrai).
              </p>
            ) : null}

            <label className="field">
              <span>Nota (opcional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Referência de guia, fornecedor..."
              />
            </label>

            <button type="submit" className="btn primary">
              Registar movimento
            </button>
          </form>

          <div className="card">
            <div className="card-head">
              <h2>Histórico recente</h2>
            </div>
            <ul className="timeline">
              {movements.length === 0 ? (
                <li className="muted pad">Sem movimentos ainda.</li>
              ) : (
                movements.slice(0, 80).map((m) => (
                  <li key={m.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div>
                      <div className="timeline-title">{labelMovement(m)}</div>
                      <div className="timeline-meta muted">
                        {new Date(m.at).toLocaleString("pt-PT")}
                        {m.note ? ` · ${m.note}` : ""}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>
    );
  }
