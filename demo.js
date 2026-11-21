// Modo demonstração (?demo=1): imita o pedaço do cliente Supabase que o app usa,
// com dados de exemplo guardados só neste navegador. Não fala com o banco de verdade.
(function () {
  const CHAVE = 'clinica-demo-v1';

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dia = (desloc) => { const d = new Date(); d.setDate(d.getDate() + desloc); return iso(d); };
  const noMes = (meses, d) => { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() + meses); x.setDate(d); return iso(x); };
  const r2 = (n) => Math.round(n * 100) / 100;

  function semente() {
    const prof = [
      { id: uid(), nome: 'Dra. Titular', e_parceiro: false, perc_consulta: 30, perc_cirurgico: 40, perc_laser: 60, ativo: true },
      { id: uid(), nome: 'Dr. Parceiro A', e_parceiro: true, perc_consulta: 30, perc_cirurgico: 40, perc_laser: 60, ativo: true },
      { id: uid(), nome: 'Dra. Parceira B', e_parceiro: true, perc_consulta: 30, perc_cirurgico: 40, perc_laser: 60, ativo: true },
    ];
    const proc = [
      ['Consulta', 'consulta', 12, 600], ['Retorno', 'consulta', null, 0], ['Toxina botulínica', 'consulta', 4, 1800],
      ['Preenchimento', 'consulta', 12, 2500], ['Bioestimulador', 'consulta', 12, 3000], ['Laser', 'laser', 6, 1500],
      ['Ultraformer', 'laser', 12, 4500], ['Biópsia', 'cirurgico', null, 900],
    ].map(([nome, categoria, meses_para_retorno, preco_tabela]) => ({ id: uid(), nome, categoria, meses_para_retorno, preco_tabela, ativo: true }));
    const forn = ['Fornecedor A', 'Fornecedor B', 'Fornecedor C', 'Fornecedor D', 'Fornecedor E', 'Fornecedor F'].map((nome) => ({ id: uid(), nome, contato: null, whatsapp: null }));
    const produtos = [
      { id: uid(), nome: 'Toxina botulínica 200 U', marca: null, fornecedor_id: forn[0].id, unidade: 'frasco', conteudo: 200, unidade_conteudo: 'U', custo: 934, estoque_minimo: 5, ativo: true },
      { id: uid(), nome: 'Ácido hialurônico 1 ml', marca: null, fornecedor_id: forn[1].id, unidade: 'seringa', conteudo: 1, unidade_conteudo: 'ml', custo: 300, estoque_minimo: 4, ativo: true },
      { id: uid(), nome: 'Bioestimulador', marca: null, fornecedor_id: forn[1].id, unidade: 'frasco', conteudo: null, unidade_conteudo: null, custo: 900, estoque_minimo: 2, ativo: true },
    ];
    const lotes = [
      { id: uid(), produto_id: produtos[0].id, lote: 'TX2611', validade: noMes(8, 30), quantidade: 6, custo_unitario: 934, recebido_em: dia(-20), conferido_por: 'Marcella' },
      { id: uid(), produto_id: produtos[1].id, lote: 'AH0925', validade: dia(40), quantidade: 6, custo_unitario: 300, recebido_em: dia(-30), conferido_por: 'Marcella' },
    ];
    const mov = [
      { produto_id: produtos[0].id, lote_id: lotes[0].id, tipo: 'entrada', quantidade: 6, data: dia(-20) },
      { produto_id: produtos[0].id, tipo: 'aberto', quantidade: 1, data: dia(-6) },
      { produto_id: produtos[0].id, tipo: 'terminado', quantidade: 1, data: dia(-2) },
      { produto_id: produtos[0].id, tipo: 'aberto', quantidade: 1, data: dia(-2) },
      { produto_id: produtos[1].id, lote_id: lotes[1].id, tipo: 'entrada', quantidade: 6, data: dia(-30) },
      { produto_id: produtos[1].id, tipo: 'terminado', quantidade: 3, data: dia(-5) },
    ].map((m) => ({ id: uid(), observacao: null, created_at: m.data + 'T12:00:00Z', ...m }));

    const pac = ['Paciente 01', 'Paciente 02', 'Paciente 03', 'Paciente 04', 'Paciente 05', 'Paciente 06', 'Paciente 07', 'Paciente 08'];
    const rec = [];
    for (let i = 0; i < 14; i++) {
      const p = proc[[0, 2, 3, 2, 5, 0, 4, 2, 6, 0, 3, 2, 1, 2][i]];
      const pf = i < 9;
      rec.push({
        id: uid(), data: dia(-Math.min(i, 12) * 1), paciente: pac[i % pac.length], profissional_id: prof[0].id, procedimento_id: p.id,
        descricao: null, valor_cheio: p.preco_tabela, valor: r2(p.preco_tabela * (i % 4 === 0 ? 0.9 : 1)),
        forma: ['credito_parcelado', 'pix', 'credito_vista', 'debito'][i % 4], parcelas: i % 4 === 0 ? 3 : 1,
        conta: pf ? 'pf_itau' : 'pj_itau', documento: pf ? 'recibo_pf' : 'nota_pj', foto_path: null, observacao: null,
        created_at: new Date().toISOString(),
      });
    }

    const contas = [];
    const parcelas = [];
    const conta = (descricao, categoria, titular, meio, fornecedor_id, valor, n, inicio, primeiro, recorrente) => {
      const c = { id: uid(), descricao, fornecedor_id, categoria, titular, meio, recorrente: !!recorrente, observacao: null, created_at: new Date().toISOString() };
      contas.push(c);
      for (let k = inicio, m = 0; k <= n; k++, m++) {
        const venc = new Date(primeiro + 'T12:00:00'); venc.setMonth(venc.getMonth() + m);
        parcelas.push({ id: uid(), conta_id: c.id, numero: k, total: n, vencimento: iso(venc), valor, status: venc < new Date() ? 'pago' : 'a_pagar', pago_em: null, comprovante_path: null });
      }
    };
    conta('Contador', 'Contador', 'pf', 'boleto', null, 800, 12, 1, noMes(0, 10), true);
    conta('Contador', 'Contador', 'pj', 'boleto', null, 800, 12, 1, noMes(0, 10), true);
    conta('Condomínio da sala', 'Condomínio', 'pf', 'boleto', null, 1450, 12, 1, noMes(0, 5), true);
    conta('Toxina (6 frascos)', 'Insumos', 'pj', 'boleto', forn[0].id, 1868, 3, 2, noMes(0, 15));
    conta('Laser - parcelamento', 'Equipamentos', 'pf', 'cartao', forn[2].id, 4200, 5, 3, noMes(0, 20));

    const rep = [
      { profissional_id: prof[1].id, paciente: 'Paciente do parceiro', tipo: 'consulta', valor_bruto: 700, imposto: 42, material: 0, percentual: 30, recebido: false, data: dia(-3) },
      { profissional_id: prof[1].id, paciente: 'Paciente do parceiro', tipo: 'laser', valor_bruto: 1800, imposto: 108, material: 150, percentual: 60, recebido: true, data: dia(-8) },
    ].map((r) => ({ id: uid(), recebido_em: null, observacao: null, created_at: new Date().toISOString(), ...r }));

    const hoje = new Date();
    const mes = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-01';
    return {
      perfis: [], profissionais: prof, procedimentos: proc, fornecedores: forn, produtos, lotes, movimentos_estoque: mov,
      recebimentos: rec, meta_pf: [{ mes, despesas_livro_caixa: 25000, adicional: 3000 }],
      caixinha: [{ id: uid(), data: dia(-1), descricao: 'Reforço da caixinha', valor: 200, created_at: new Date().toISOString() },
                 { id: uid(), data: dia(0), descricao: 'Pão e café', valor: -38.5, created_at: new Date().toISOString() }],
      contas_pagar: contas, parcelas_pagar: parcelas, repasses: rep,
    };
  }

  let db;
  try { db = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { db = null; }
  if (!db) db = semente();
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch (e) { /* sem armazenamento: segue em memória */ } };

  const PADROES = {
    recebimentos: { parcelas: 1, documento: 'nenhum', descricao: null, foto_path: null, observacao: null },
    parcelas_pagar: { status: 'a_pagar', pago_em: null, comprovante_path: null },
    contas_pagar: { categoria: 'Outros', meio: 'boleto', recorrente: false, observacao: null },
    produtos: { unidade: 'frasco', estoque_minimo: 0, ativo: true },
    movimentos_estoque: { quantidade: 1, observacao: null },
    repasses: { imposto: 0, material: 0, recebido: false, recebido_em: null },
    meta_pf: { despesas_livro_caixa: 0, adicional: 3000 },
  };
  const SEM_ID = { meta_pf: true };

  function bruta(tabela) { if (!db[tabela]) db[tabela] = []; return db[tabela]; }
  function linhas(tabela) {
    if (tabela === 'saldo_estoque') {
      return db.produtos.filter((p) => p.ativo).map((p) => {
        let saldo = 0; let abertos = 0;
        db.movimentos_estoque.filter((m) => m.produto_id === p.id).forEach((m) => {
          if (m.tipo === 'entrada' || m.tipo === 'ajuste') saldo += m.quantidade;
          if (m.tipo === 'terminado' || m.tipo === 'descartado') saldo -= m.quantidade;
          if (m.tipo === 'aberto') abertos += m.quantidade;
          if (m.tipo === 'terminado') abertos -= m.quantidade;
        });
        abertos = p.unidade === 'frasco' ? Math.max(0, abertos) : 0;
        return { produto_id: p.id, nome: p.nome, marca: p.marca, unidade: p.unidade, estoque_minimo: p.estoque_minimo, saldo, abertos };
      });
    }
    if (tabela === 'repasses') {
      return db.repasses.map((r) => ({ ...r, valor_devido: r2((r.valor_bruto - r.imposto - r.material) * r.percentual / 100) }));
    }
    return bruta(tabela);
  }

  class Consulta {
    constructor(tabela) { this.t = tabela; this.filtros = []; this.op = null; this.ordem = []; this.lim = null; this.um = false; }
    select() { if (!this.op) this.op = 'select'; return this; }
    insert(v) { this.op = 'insert'; this.val = Array.isArray(v) ? v : [v]; return this; }
    upsert(v, opts) { this.op = 'upsert'; this.val = Array.isArray(v) ? v : [v]; this.conflito = (opts && opts.onConflict) || 'id'; return this; }
    update(v) { this.op = 'update'; this.val = v; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.filtros.push((r) => r[c] === v); return this; }
    neq(c, v) { this.filtros.push((r) => r[c] !== v); return this; }
    gte(c, v) { this.filtros.push((r) => r[c] != null && r[c] >= v); return this; }
    gt(c, v) { this.filtros.push((r) => r[c] != null && r[c] > v); return this; }
    lte(c, v) { this.filtros.push((r) => r[c] != null && r[c] <= v); return this; }
    lt(c, v) { this.filtros.push((r) => r[c] != null && r[c] < v); return this; }
    in(c, lista) { this.filtros.push((r) => lista.includes(r[c])); return this; }
    order(c, o) { this.ordem.push([c, !(o && o.ascending === false)]); return this; }
    limit(n) { this.lim = n; return this; }
    maybeSingle() { this.um = true; return this; }
    single() { this.um = true; return this; }
    then(ok, falha) { return Promise.resolve().then(() => this.executar()).then(ok, falha); }

    executar() {
      const passa = (r) => this.filtros.every((f) => f(r));
      const t = this.t;
      if (this.op === 'insert' || this.op === 'upsert') {
        const novos = this.val.map((v) => {
          const linha = { ...(PADROES[t] || {}), ...v };
          if (!SEM_ID[t] && !linha.id) linha.id = uid();
          if (!linha.created_at) linha.created_at = new Date().toISOString();
          if (('data' in linha || t === 'recebimentos' || t === 'movimentos_estoque' || t === 'repasses' || t === 'caixinha') && !linha.data) linha.data = dia(0);
          return linha;
        });
        const tabela = bruta(t);
        novos.forEach((n) => {
          const i = this.op === 'upsert' ? tabela.findIndex((r) => r[this.conflito] === n[this.conflito]) : -1;
          if (i >= 0) tabela[i] = { ...tabela[i], ...n }; else tabela.push(n);
        });
        salvar();
        return { data: this.um ? novos[0] : novos, error: null };
      }
      if (this.op === 'update') {
        const alvo = bruta(t).filter(passa);
        alvo.forEach((r) => Object.assign(r, this.val));
        salvar();
        return { data: alvo, error: null };
      }
      if (this.op === 'delete') {
        if (t === 'contas_pagar') {
          const ids = db.contas_pagar.filter(passa).map((c) => c.id);
          db.parcelas_pagar = db.parcelas_pagar.filter((p) => !ids.includes(p.conta_id));
        }
        db[t] = bruta(t).filter((r) => !passa(r));
        salvar();
        return { data: null, error: null };
      }
      let res = linhas(t).filter(passa).map((r) => ({ ...r }));
      this.ordem.slice().reverse().forEach(([c, asc]) => {
        res.sort((a, b) => (a[c] === b[c] ? 0 : (a[c] > b[c] ? 1 : -1)) * (asc ? 1 : -1));
      });
      if (this.lim != null) res = res.slice(0, this.lim);
      return { data: this.um ? (res[0] || null) : res, error: null };
    }
  }

  window.criarClienteDemo = function () {
    const sessao = { user: { id: 'demo', email: 'demonstracao@clinica' } };
    return {
      demo: true,
      from: (t) => new Consulta(t),
      rpc: async (nome) => (nome === 'meu_papel' ? { data: 'admin', error: null } : { data: null, error: { message: 'rpc ' + nome } }),
      auth: {
        getSession: async () => ({ data: { session: sessao }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => { location.href = location.pathname; return { error: null }; },
        signInWithOtp: async () => ({ error: null }),
      },
      reiniciar() { try { localStorage.removeItem(CHAVE); } catch (e) { /* ignora */ } location.reload(); },
    };
  };
})();
