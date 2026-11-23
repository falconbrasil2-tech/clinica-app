// App da clínica Maria Issa: caixa, contas a pagar, estoque, repasses e painel.
(function () {
  'use strict';

  // ---------- utilitários ----------
  const $ = (sel, raiz) => (raiz || document).querySelector(sel);
  const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  // Aceita "1.234,56", "1234,56", "1234.56" e "1.500" (milhar com ponto).
  const num = (v) => {
    if (v == null) return null;
    let s = String(v).trim().replace(/[R$\s]/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };
  const soma = (lista, f) => lista.reduce((t, x) => t + (Number(f(x)) || 0), 0);
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const hoje = () => iso(new Date());
  const dataBR = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '');
  const mesAtual = () => hoje().slice(0, 7);
  const inicioMes = (ym) => ym + '-01';
  const somaMeses = (ym, n) => { const [a, m] = ym.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); return iso(d).slice(0, 7); };
  const fimMesExcl = (ym) => inicioMes(somaMeses(ym, 1));
  const nomeMes = (ym) => { const [a, m] = ym.split('-').map(Number); const t = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const mesCurto = (ym) => { const [a, m] = ym.split('-').map(Number); return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(a).slice(2); };
  const addMesesData = (isoData, n) => {
    const [a, m, d] = isoData.split('-').map(Number);
    const ultimo = new Date(a, m - 1 + n + 1, 0).getDate();
    return iso(new Date(a, m - 1 + n, Math.min(d, ultimo)));
  };
  const daquiDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

  const ROTULO_CONTA = { pf_itau: 'PF Itaú', pj_itau: 'PJ Itaú', bradesco_pessoal: 'Bradesco pessoal', dinheiro: 'Dinheiro' };
  const ROTULO_FORMA = { pix: 'Pix', debito: 'Débito', credito_vista: 'Crédito à vista', credito_parcelado: 'Crédito parcelado', dinheiro: 'Dinheiro', boleto: 'Boleto', transferencia: 'Transferência' };
  const ROTULO_DOC = { nota_pj: 'Nota PJ', recibo_pf: 'Recibo PF', nenhum: 'Sem documento' };
  const ROTULO_MEIO = { boleto: 'Boleto', cartao: 'Cartão', pix: 'Pix', debito_automatico: 'Débito automático', dinheiro: 'Dinheiro' };
  const ROTULO_TIPO = { consulta: 'Consulta', cirurgico: 'Cirúrgico', laser: 'Laser e máquinas' };
  const ROTULO_STATUS = { a_pagar: 'A pagar', separado: 'Separado', pago: 'Pago' };
  const ROTULO_PAPEL = { admin: 'Administrador', dona: 'Dra.', gerente: 'Gerente', estoque: 'Estoque' };
  const opcoes = (obj, sel) => Object.entries(obj).map(([v, t]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const opcoesLista = (lista, sel, vazio) => (vazio != null ? `<option value="">${esc(vazio)}</option>` : '') +
    lista.map((x) => `<option value="${x.id}"${x.id === sel ? ' selected' : ''}>${esc(x.nome)}</option>`).join('');

  function avisar(msg) {
    const el = $('#aviso'); el.textContent = msg; el.hidden = false;
    clearTimeout(avisar.t); avisar.t = setTimeout(() => { el.hidden = true; }, 3500);
  }
  async function q(promessa) {
    const { data, error } = await promessa;
    if (error) { avisar('Erro: ' + error.message); throw error; }
    return data;
  }
  const dadosForm = (form) => Object.fromEntries(new FormData(form).entries());

  // ---------- estado ----------
  const E = { cli: null, papel: null, email: '', aba: null, ref: {}, mesCaixa: mesAtual(), diaCaixa: hoje(), verMes: false, mesContas: mesAtual(), mesRepasses: mesAtual() };

  const ABAS = [
    { id: 'painel', nome: 'Painel', papeis: ['admin', 'dona', 'gerente'] },
    { id: 'caixa', nome: 'Caixa', papeis: ['admin', 'dona', 'gerente'] },
    { id: 'contas', nome: 'Contas a pagar', papeis: ['admin', 'dona', 'gerente'] },
    { id: 'estoque', nome: 'Estoque', papeis: ['admin', 'dona', 'gerente', 'estoque'] },
    { id: 'repasses', nome: 'Repasses', papeis: ['admin', 'dona', 'gerente'] },
  ];

  async function carregarReferencias() {
    const financeiro = E.papel !== 'estoque';
    const [forn, prod] = await Promise.all([
      q(E.cli.from('fornecedores').select('*').order('nome')),
      q(E.cli.from('produtos').select('*').eq('ativo', true).order('nome')),
    ]);
    E.ref.fornecedores = forn; E.ref.produtos = prod;
    if (financeiro) {
      const [prof, proc] = await Promise.all([
        q(E.cli.from('profissionais').select('*').eq('ativo', true).order('nome')),
        q(E.cli.from('procedimentos').select('*').eq('ativo', true).order('nome')),
      ]);
      E.ref.profissionais = prof; E.ref.procedimentos = proc;
    }
  }
  const porId = (lista, id) => (lista || []).find((x) => x.id === id);
  const nomeDe = (lista, id) => (porId(lista, id) || {}).nome || '';

  // ---------- início ----------
  async function iniciar() {
    const demo = new URLSearchParams(location.search).has('demo');
    if (demo) {
      E.cli = window.criarClienteDemo();
      $('#faixa-demo').hidden = false;
    } else {
      E.cli = window.supabase.createClient(window.CLINICA_CONFIG.url, window.CLINICA_CONFIG.key);
      E.cli.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_IN' && !E.papel) entrar(); });
    }
    await entrar();
  }

  async function entrar() {
    const { data } = await E.cli.auth.getSession();
    const sessao = data && data.session;
    if (!sessao) return telaLogin();
    E.email = sessao.user.email;
    const { data: papel } = await E.cli.rpc('meu_papel');
    if (!papel) return telaSemAcesso();
    E.papel = papel;
    await carregarReferencias();
    montarTopo();
    const permitidas = ABAS.filter((a) => a.papeis.includes(E.papel));
    let salva = null; try { salva = localStorage.getItem('clinica-aba'); } catch (e) { /* ignora */ }
    irPara(permitidas.some((a) => a.id === salva) ? salva : permitidas[0].id);
  }

  function telaLogin() {
    $('#abas').hidden = true; $('#usuario').innerHTML = '';
    $('#conteudo').innerHTML = `
      <section class="cartao login">
        <h2>Entrar</h2>
        <p class="legenda">Digite seu e-mail. Você recebe um link para entrar, sem senha.</p>
        <form id="f-login" class="form">
          <label class="largo">E-mail<input type="email" name="email" required autocomplete="email"></label>
          <button class="btn largo" type="submit">Receber link de acesso</button>
        </form>
        <p id="login-msg" class="legenda"></p>
        <p class="legenda"><a href="?demo=1">Ver demonstração com dados de exemplo</a></p>
      </section>`;
    $('#f-login').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = ev.target.email.value.trim();
      const { error } = await E.cli.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      $('#login-msg').textContent = error ? 'Não foi possível enviar: ' + error.message : 'Pronto. Abra seu e-mail e clique no link.';
    });
  }

  function telaSemAcesso() {
    $('#abas').hidden = true;
    $('#conteudo').innerHTML = `
      <section class="cartao login">
        <h2>Acesso ainda não liberado</h2>
        <p>Você entrou como <b>${esc(E.email)}</b>, mas este e-mail ainda não tem acesso. Peça ao Bruno para liberar.</p>
        <button class="btn sec" id="b-sair">Sair</button>
      </section>`;
    $('#b-sair').onclick = () => E.cli.auth.signOut().then(() => location.reload());
  }

  function montarTopo() {
    const nav = $('#abas'); nav.hidden = false;
    nav.innerHTML = ABAS.filter((a) => a.papeis.includes(E.papel)).map((a) => `<button data-aba="${a.id}">${a.nome}</button>`).join('');
    nav.onclick = (ev) => { const b = ev.target.closest('button[data-aba]'); if (b) irPara(b.dataset.aba); };
    $('#usuario').innerHTML = (E.cli.demo ? '' : `<span>${esc(E.email)} · ${esc(ROTULO_PAPEL[E.papel] || E.papel)}</span>`) +
      (E.cli.demo ? '<button class="btn peq sec" id="b-reiniciar">Reiniciar exemplo</button>' : '') +
      (E.cli.demo ? '' : '<button class="btn peq sec" id="b-sair">Sair</button>');
    if (!E.cli.demo) $('#b-sair').onclick = () => E.cli.auth.signOut().then(() => location.reload());
    if (E.cli.demo) $('#b-reiniciar').onclick = () => E.cli.reiniciar();
  }

  async function irPara(aba) {
    E.aba = aba;
    try { localStorage.setItem('clinica-aba', aba); } catch (e) { /* ignora */ }
    $$('#abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === aba));
    $('#conteudo').innerHTML = '<p class="vazio">Carregando…</p>';
    try { await TELAS[aba](); } catch (e) { console.error(e); $('#conteudo').innerHTML = '<p class="vazio">Não foi possível carregar. Tente de novo.</p>'; }
  }
  const recarregar = () => irPara(E.aba);

  // ---------- dados compartilhados ----------
  async function medidorPF(ym) {
    const [meta, recibos] = await Promise.all([
      q(E.cli.from('meta_pf').select('*').eq('mes', inicioMes(ym)).maybeSingle()),
      q(E.cli.from('recebimentos').select('valor').eq('documento', 'recibo_pf').gte('data', inicioMes(ym)).lt('data', fimMesExcl(ym))),
    ]);
    const despesas = meta ? Number(meta.despesas_livro_caixa) : 0;
    const adicional = meta ? Number(meta.adicional) : 3000;
    const alvo = despesas + adicional;
    const emitido = soma(recibos, (r) => r.valor);
    return { despesas, adicional, alvo, emitido, falta: alvo - emitido, temMeta: !!meta && despesas > 0 };
  }

  function htmlMedidor(m, compacto) {
    const pct = m.alvo > 0 ? Math.min(100, (m.emitido / m.alvo) * 100) : 0;
    let msg;
    if (!m.temMeta) msg = '<div class="mensagem alerta">Informe as despesas do livro-caixa do mês para calcular o limite da PF.</div>';
    else if (m.falta > 0) msg = `<div class="mensagem alerta">Continue na <b>maquininha PF</b>. Faltam <b>${brl(m.falta)}</b> de recibo.</div>`;
    else msg = `<div class="mensagem ok">Limite da PF atingido${m.falta < 0 ? ` (passou ${brl(-m.falta)})` : ''}. Use a <b>maquininha PJ</b> e emita nota.</div>`;
    return `<div class="numero">${brl(m.emitido)} <span class="legenda">de ${brl(m.alvo)}</span></div>
      <div class="barra${pct >= 100 ? ' cheia' : ''}"><div style="width:${pct.toFixed(1)}%"></div></div>
      ${compacto ? '' : `<div class="legenda">Limite = despesas do livro-caixa ${brl(m.despesas)} + adicional ${brl(m.adicional)}</div>`}
      ${msg}`;
  }

  // ---------- PAINEL ----------
  async function telaPainel() {
    const ym = mesAtual();
    const [m, rec, parc, rep, saldo, lotes] = await Promise.all([
      medidorPF(ym),
      q(E.cli.from('recebimentos').select('valor,conta,data').gte('data', inicioMes(ym)).lt('data', fimMesExcl(ym))),
      q(E.cli.from('parcelas_pagar').select('*').gte('vencimento', inicioMes(ym)).lt('vencimento', fimMesExcl(somaMeses(ym, 2)))),
      q(E.cli.from('repasses').select('*').eq('recebido', false)),
      q(E.cli.from('saldo_estoque').select('*')),
      q(E.cli.from('lotes').select('*').lte('validade', daquiDias(60)).gte('validade', hoje())),
    ]);
    const deHoje = rec.filter((r) => r.data === hoje());
    const porConta = Object.keys(ROTULO_CONTA).map((c) => [c, soma(rec.filter((r) => r.conta === c), (r) => r.valor)]).filter(([, v]) => v > 0);
    const meses = [0, 1, 2].map((i) => somaMeses(ym, i));
    const parcMes = (x) => parc.filter((p) => p.vencimento.slice(0, 7) === x);
    const criticos = saldo.filter((s) => s.saldo <= s.estoque_minimo);
    const aReceber = soma(rep, (r) => r.valor_devido);

    $('#conteudo').innerHTML = `
      <div class="grade">
        <section class="cartao"><h2>Hoje</h2>
          <div class="numero">${brl(soma(deHoje, (r) => r.valor))}</div>
          <div class="legenda">${deHoje.length} recebimento(s) lançado(s)</div></section>
        <section class="cartao"><h2>Entrou em ${esc(nomeMes(ym).toLowerCase())}</h2>
          <div class="numero">${brl(soma(rec, (r) => r.valor))}</div>
          <div class="legenda">${porConta.map(([c, v]) => `${ROTULO_CONTA[c]}: ${brl(v)}`).join(' · ') || 'Nada lançado ainda'}</div></section>
        <section class="cartao"><h2>Recibos da PF no mês</h2>${htmlMedidor(m, true)}</section>
      </div>
      <div class="grade">
        <section class="cartao"><h2>Contas a pagar</h2>
          <div class="tabela-rolagem"><table><thead><tr><th>Mês</th><th class="valor">Total</th><th class="valor">A pagar</th></tr></thead><tbody>
          ${meses.map((x) => `<tr><td>${esc(mesCurto(x))}</td><td class="valor">${brl(soma(parcMes(x), (p) => p.valor))}</td>
            <td class="valor">${brl(soma(parcMes(x).filter((p) => p.status !== 'pago'), (p) => p.valor))}</td></tr>`).join('')}
          </tbody></table></div></section>
        <section class="cartao"><h2>A receber dos médicos</h2>
          <div class="numero">${brl(aReceber)}</div><div class="legenda">${rep.length} repasse(s) em aberto</div></section>
        <section class="cartao"><h2>Estoque</h2>
          ${criticos.length ? criticos.map((s) => `<div><span class="etiqueta erro">Repor</span> ${esc(s.nome)}: ${s.saldo} ${esc(s.unidade)}(s)</div>`).join('') : '<div class="etiqueta ok">Nada abaixo do mínimo</div>'}
          ${lotes.length ? `<h3>Vencendo em até 60 dias</h3>${lotes.map((l) => `<div>${esc(nomeDe(E.ref.produtos, l.produto_id))}, lote ${esc(l.lote || '-')}: ${dataBR(l.validade)}</div>`).join('')}` : ''}
        </section>
      </div>`;
  }

  // ---------- CAIXA ----------
  async function telaCaixa() {
    const ym = E.mesCaixa;
    const [m, recMes, caixinha] = await Promise.all([
      medidorPF(ym),
      q(E.cli.from('recebimentos').select('*').gte('data', inicioMes(ym)).lt('data', fimMesExcl(ym)).order('data', { ascending: false }).order('created_at', { ascending: false })),
      q(E.cli.from('caixinha').select('*').order('data', { ascending: false }).order('created_at', { ascending: false }).limit(200)),
    ]);
    const contaSugerida = m.temMeta && m.falta <= 0 ? 'pj_itau' : 'pf_itau';
    const lista = E.verMes ? recMes : recMes.filter((r) => r.data === E.diaCaixa);
    const saldoCaixinha = soma(caixinha, (c) => c.valor);
    const contas = Object.keys(ROTULO_CONTA);
    const formas = Object.keys(ROTULO_FORMA).filter((f) => recMes.some((r) => r.forma === f));

    $('#conteudo').innerHTML = `
      <section class="cartao"><h2>Recibos da PF · ${esc(nomeMes(ym))}</h2>
        ${htmlMedidor(m)}
        <details${m.temMeta ? '' : ' open'}><summary>Ajustar o limite do mês</summary>
          <form id="f-meta" class="form">
            <label>Despesas do livro-caixa<input name="despesas" inputmode="decimal" value="${m.despesas || ''}" placeholder="ex.: 25000"></label>
            <label>Adicional<input name="adicional" inputmode="decimal" value="${m.adicional}"></label>
            <button class="btn" type="submit">Salvar</button>
          </form></details>
      </section>

      <section class="cartao"><h2>Novo recebimento</h2>
        <form id="f-rec" class="form">
          <label>Data<input type="date" name="data" value="${E.diaCaixa}" required></label>
          <label>Paciente<input name="paciente" required></label>
          <label>Profissional<select name="profissional_id">${opcoesLista(E.ref.profissionais, (E.ref.profissionais.find((p) => !p.e_parceiro) || {}).id)}</select></label>
          <label>Procedimento<select name="procedimento_id">${opcoesLista(E.ref.procedimentos, null, 'Escolha')}</select></label>
          <label>Valor de tabela<input name="valor_cheio" inputmode="decimal"></label>
          <label>Valor cobrado<input name="valor" inputmode="decimal" required></label>
          <label>Forma<select name="forma">${opcoes(ROTULO_FORMA, 'credito_vista')}</select></label>
          <label>Parcelas<input type="number" name="parcelas" min="1" max="24" value="1"></label>
          <label>Conta<select name="conta">${opcoes(ROTULO_CONTA, contaSugerida)}</select></label>
          <label>Documento<select name="documento">${opcoes(ROTULO_DOC, contaSugerida === 'pf_itau' ? 'recibo_pf' : 'nota_pj')}</select></label>
          <label class="largo">Observação<input name="observacao"></label>
          <button class="btn" type="submit">Lançar</button>
        </form>
      </section>

      <section class="cartao"><h2>Lançamentos</h2>
        <div class="filtros">
          <label>Mês <input type="month" id="c-mes" value="${ym}"></label>
          <label>Dia <input type="date" id="c-dia" value="${E.diaCaixa}" ${E.verMes ? 'disabled' : ''}></label>
          <label><input type="checkbox" id="c-vermes" ${E.verMes ? 'checked' : ''} style="width:auto"> Ver o mês inteiro</label>
        </div>
        ${lista.length ? `<div class="tabela-rolagem"><table><thead><tr><th>Data</th><th>Paciente</th><th>Procedimento</th><th>Profissional</th><th>Forma</th><th>Conta</th><th>Doc.</th><th class="valor">Valor</th><th></th></tr></thead><tbody>
          ${lista.map((r) => `<tr><td>${dataBR(r.data)}</td><td>${esc(r.paciente)}</td><td>${esc(nomeDe(E.ref.procedimentos, r.procedimento_id) || r.descricao || '')}</td>
            <td>${esc(nomeDe(E.ref.profissionais, r.profissional_id))}</td><td>${esc(ROTULO_FORMA[r.forma])}${r.parcelas > 1 ? ' ' + r.parcelas + 'x' : ''}</td>
            <td>${esc(ROTULO_CONTA[r.conta])}</td><td>${esc(ROTULO_DOC[r.documento])}</td>
            <td class="valor">${brl(r.valor)}${r.valor_cheio && Number(r.valor_cheio) > Number(r.valor) ? `<div class="legenda">desc. ${brl(r.valor_cheio - r.valor)}</div>` : ''}</td>
            <td><button class="btn peq perigo" data-apagar="${r.id}">Apagar</button></td></tr>`).join('')}
          <tr class="total"><td colspan="7">Total</td><td class="valor">${brl(soma(lista, (r) => r.valor))}</td><td></td></tr>
          </tbody></table></div>` : '<p class="vazio">Nenhum lançamento.</p>'}
      </section>

      <section class="cartao"><h2>Fechamento de ${esc(nomeMes(ym).toLowerCase())}</h2>
        ${recMes.length ? `<div class="tabela-rolagem"><table><thead><tr><th>Conta</th>${formas.map((f) => `<th class="valor">${esc(ROTULO_FORMA[f])}</th>`).join('')}<th class="valor">Total</th></tr></thead><tbody>
          ${contas.filter((c) => recMes.some((r) => r.conta === c)).map((c) => `<tr><td>${esc(ROTULO_CONTA[c])}</td>
            ${formas.map((f) => `<td class="valor">${brl(soma(recMes.filter((r) => r.conta === c && r.forma === f), (r) => r.valor))}</td>`).join('')}
            <td class="valor"><b>${brl(soma(recMes.filter((r) => r.conta === c), (r) => r.valor))}</b></td></tr>`).join('')}
          <tr class="total"><td>Total</td>${formas.map((f) => `<td class="valor">${brl(soma(recMes.filter((r) => r.forma === f), (r) => r.valor))}</td>`).join('')}<td class="valor">${brl(soma(recMes, (r) => r.valor))}</td></tr>
          </tbody></table></div>
          <p class="legenda">Descontos dados no mês: ${brl(soma(recMes.filter((r) => r.valor_cheio), (r) => Math.max(0, r.valor_cheio - r.valor)))}</p>` : '<p class="vazio">Sem lançamentos no mês.</p>'}
      </section>

      <section class="cartao"><h2>Caixinha em dinheiro</h2>
        <div class="numero">${brl(saldoCaixinha)}</div><div class="legenda">saldo atual</div>
        <form id="f-caixinha" class="form" style="margin-top:10px">
          <label>Data<input type="date" name="data" value="${hoje()}"></label>
          <label>Descrição<input name="descricao" required placeholder="ex.: pão e café"></label>
          <label>Valor<input name="valor" inputmode="decimal" required></label>
          <label>Tipo<select name="tipo"><option value="saida">Saída</option><option value="entrada">Entrada</option></select></label>
          <button class="btn" type="submit">Lançar</button>
        </form>
        ${caixinha.length ? `<div class="tabela-rolagem"><table style="margin-top:10px"><tbody>${caixinha.slice(0, 15).map((c) => `<tr><td>${dataBR(c.data)}</td><td>${esc(c.descricao)}</td><td class="valor">${brl(c.valor)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      </section>`;

    const fRec = $('#f-rec');
    fRec.conta.onchange = () => { fRec.documento.value = { pf_itau: 'recibo_pf', pj_itau: 'nota_pj' }[fRec.conta.value] || 'nenhum'; };
    fRec.forma.onchange = () => { if (fRec.forma.value !== 'credito_parcelado') fRec.parcelas.value = 1; };
    fRec.procedimento_id.onchange = () => {
      const p = porId(E.ref.procedimentos, fRec.procedimento_id.value);
      if (p && p.preco_tabela) { fRec.valor_cheio.value = p.preco_tabela; if (!fRec.valor.value) fRec.valor.value = p.preco_tabela; }
    };
    fRec.onsubmit = async (ev) => {
      ev.preventDefault();
      const d = dadosForm(fRec);
      const valor = num(d.valor);
      if (valor == null) return avisar('Valor cobrado inválido.');
      await q(E.cli.from('recebimentos').insert({
        data: d.data, paciente: d.paciente.trim(), profissional_id: d.profissional_id || null, procedimento_id: d.procedimento_id || null,
        valor_cheio: num(d.valor_cheio), valor, forma: d.forma, parcelas: Math.max(1, parseInt(d.parcelas, 10) || 1),
        conta: d.conta, documento: d.documento, observacao: d.observacao || null,
      }));
      E.diaCaixa = d.data; E.mesCaixa = d.data.slice(0, 7);
      avisar('Recebimento lançado.'); recarregar();
    };
    $('#f-meta').onsubmit = async (ev) => {
      ev.preventDefault();
      const d = dadosForm(ev.target);
      await q(E.cli.from('meta_pf').upsert({ mes: inicioMes(ym), despesas_livro_caixa: num(d.despesas) || 0, adicional: num(d.adicional) ?? 3000 }, { onConflict: 'mes' }));
      avisar('Limite salvo.'); recarregar();
    };
    $('#f-caixinha').onsubmit = async (ev) => {
      ev.preventDefault();
      const d = dadosForm(ev.target); const v = num(d.valor);
      if (v == null) return avisar('Valor inválido.');
      await q(E.cli.from('caixinha').insert({ data: d.data, descricao: d.descricao.trim(), valor: d.tipo === 'saida' ? -Math.abs(v) : Math.abs(v) }));
      recarregar();
    };
    $('#c-mes').onchange = (ev) => { if (!ev.target.value) return; E.mesCaixa = ev.target.value; if (E.diaCaixa.slice(0, 7) !== E.mesCaixa) E.diaCaixa = inicioMes(E.mesCaixa); recarregar(); };
    $('#c-dia').onchange = (ev) => { if (!ev.target.value) return; E.diaCaixa = ev.target.value; E.mesCaixa = E.diaCaixa.slice(0, 7); recarregar(); };
    $('#c-vermes').onchange = (ev) => { E.verMes = ev.target.checked; recarregar(); };
    $$('[data-apagar]').forEach((b) => { b.onclick = async () => {
      if (!confirm('Apagar este lançamento?')) return;
      await q(E.cli.from('recebimentos').delete().eq('id', b.dataset.apagar)); recarregar();
    }; });
  }

  // ---------- CONTAS A PAGAR ----------
  async function telaContas() {
    const ym = E.mesContas;
    const meses = [0, 1, 2, 3, 4, 5].map((i) => somaMeses(mesAtual(), i));
    const [parcFut, parcMes, contas] = await Promise.all([
      q(E.cli.from('parcelas_pagar').select('*').gte('vencimento', inicioMes(meses[0])).lt('vencimento', fimMesExcl(meses[5]))),
      q(E.cli.from('parcelas_pagar').select('*').gte('vencimento', inicioMes(ym)).lt('vencimento', fimMesExcl(ym)).order('vencimento')),
      q(E.cli.from('contas_pagar').select('*')),
    ]);
    const conta = (id) => porId(contas, id) || {};
    const doMes = (x, tit) => parcFut.filter((p) => p.vencimento.slice(0, 7) === x && (!tit || conta(p.conta_id).titular === tit));
    const atrasadas = parcMes.filter((p) => p.status !== 'pago' && p.vencimento < hoje());

    $('#conteudo').innerHTML = `
      <section class="cartao"><h2>Quanto vai sair nos próximos meses</h2>
        <div class="tabela-rolagem"><table><thead><tr><th>Mês</th><th class="valor">PF</th><th class="valor">PJ</th><th class="valor">Total</th><th class="valor">Já pago</th></tr></thead><tbody>
        ${meses.map((x) => `<tr><td>${esc(nomeMes(x))}</td><td class="valor">${brl(soma(doMes(x, 'pf'), (p) => p.valor))}</td>
          <td class="valor">${brl(soma(doMes(x, 'pj'), (p) => p.valor))}</td><td class="valor"><b>${brl(soma(doMes(x), (p) => p.valor))}</b></td>
          <td class="valor">${brl(soma(doMes(x).filter((p) => p.status === 'pago'), (p) => p.valor))}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="legenda">Inclui as contas fixas e as parcelas lançadas. Compras novas no cartão entram quando forem lançadas aqui.</p>
      </section>

      <section class="cartao"><h2>Nova conta</h2>
        <form id="f-conta" class="form">
          <label>Descrição<input name="descricao" required placeholder="ex.: Toxina, 6 frascos"></label>
          <label>Fornecedor<select name="fornecedor_id">${opcoesLista(E.ref.fornecedores, null, 'Nenhum')}</select></label>
          <label>Categoria<input name="categoria" list="l-cat" value="Insumos"></label>
          <datalist id="l-cat">${['Insumos', 'Equipamentos', 'Contador', 'Condomínio', 'Luz', 'Telefone e internet', 'Sistema', 'Salários', 'Encargos', 'Limpeza', 'Lixo hospitalar', 'Manutenção', 'Marketing', 'Impostos', 'Outros'].map((c) => `<option value="${c}">`).join('')}</datalist>
          <label>Pago por<select name="titular"><option value="pj">PJ</option><option value="pf">PF (CPF da Dra.)</option></select></label>
          <label>Meio<select name="meio">${opcoes(ROTULO_MEIO, 'boleto')}</select></label>
          <label>Valor de cada parcela<input name="valor" inputmode="decimal" required></label>
          <label>Total de parcelas<input type="number" name="total" min="1" max="60" value="1"></label>
          <label>Começa na parcela<input type="number" name="inicial" min="1" max="60" value="1"></label>
          <label>Vencimento dessa parcela<input type="date" name="vencimento" value="${hoje()}" required></label>
          <label><span><input type="checkbox" name="recorrente" style="width:auto"> Conta fixa todo mês (gera 12 meses)</span></label>
          <button class="btn" type="submit">Salvar</button>
        </form>
        <p class="legenda">Para um boleto que já está em andamento, por exemplo o "2 de 3", use total 3 e começa na parcela 2.</p>
      </section>

      <section class="cartao"><h2>Parcelas de ${esc(nomeMes(ym).toLowerCase())}</h2>
        <div class="filtros"><label>Mês <input type="month" id="p-mes" value="${ym}"></label>
          ${atrasadas.length ? `<span class="etiqueta erro">${atrasadas.length} vencida(s) sem pagar</span>` : ''}</div>
        ${parcMes.length ? `<div class="tabela-rolagem"><table><thead><tr><th>Vence</th><th>Descrição</th><th>Fornecedor</th><th>Por</th><th>Meio</th><th>Parcela</th><th class="valor">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
          ${parcMes.map((p) => { const c = conta(p.conta_id); return `<tr><td>${dataBR(p.vencimento)}${p.status !== 'pago' && p.vencimento < hoje() ? ' <span class="etiqueta erro">vencida</span>' : ''}</td>
            <td>${esc(c.descricao)}${c.recorrente ? ' <span class="etiqueta">fixa</span>' : ''}</td><td>${esc(nomeDe(E.ref.fornecedores, c.fornecedor_id))}</td>
            <td>${(c.titular || '').toUpperCase()}</td><td>${esc(ROTULO_MEIO[c.meio] || '')}</td><td>${p.numero} de ${p.total}</td>
            <td class="valor">${brl(p.valor)}</td>
            <td><select data-status="${p.id}">${opcoes(ROTULO_STATUS, p.status)}</select></td>
            <td><button class="btn peq perigo" data-apagar-conta="${c.id}" title="Apaga a conta e todas as parcelas">Apagar</button></td></tr>`; }).join('')}
          <tr class="total"><td colspan="6">Total</td><td class="valor">${brl(soma(parcMes, (p) => p.valor))}</td><td colspan="2"></td></tr>
          </tbody></table></div>` : '<p class="vazio">Nenhuma parcela neste mês.</p>'}
      </section>`;

    $('#f-conta').onsubmit = async (ev) => {
      ev.preventDefault();
      const d = dadosForm(ev.target);
      const valor = num(d.valor);
      if (valor == null) return avisar('Valor inválido.');
      const recorrente = !!d.recorrente;
      const total = recorrente ? 12 : Math.max(1, parseInt(d.total, 10) || 1);
      const inicial = recorrente ? 1 : Math.min(total, Math.max(1, parseInt(d.inicial, 10) || 1));
      const criada = await q(E.cli.from('contas_pagar').insert({
        descricao: d.descricao.trim(), fornecedor_id: d.fornecedor_id || null, categoria: d.categoria || 'Outros',
        titular: d.titular, meio: d.meio, recorrente,
      }).select());
      const contaId = criada[0].id;
      const parcelas = [];
      for (let n = inicial, k = 0; n <= total; n++, k++) {
        parcelas.push({ conta_id: contaId, numero: n, total, vencimento: addMesesData(d.vencimento, k), valor });
      }
      await q(E.cli.from('parcelas_pagar').insert(parcelas));
      avisar(`Conta salva com ${parcelas.length} parcela(s).`); recarregar();
    };
    $('#p-mes').onchange = (ev) => { if (ev.target.value) { E.mesContas = ev.target.value; recarregar(); } };
    $$('[data-status]').forEach((s) => { s.onchange = async () => {
      await q(E.cli.from('parcelas_pagar').update({ status: s.value, pago_em: s.value === 'pago' ? hoje() : null }).eq('id', s.dataset.status));
      avisar('Situação atualizada.'); recarregar();
    }; });
    $$('[data-apagar-conta]').forEach((b) => { b.onclick = async () => {
      if (!confirm('Apagar esta conta e todas as parcelas dela?')) return;
      await q(E.cli.from('contas_pagar').delete().eq('id', b.dataset.apagarConta)); recarregar();
    }; });
  }

  // ---------- ESTOQUE ----------
  async function telaEstoque() {
    const [saldo, lotes, movs] = await Promise.all([
      q(E.cli.from('saldo_estoque').select('*')),
      q(E.cli.from('lotes').select('*').order('validade')),
      q(E.cli.from('movimentos_estoque').select('*').order('created_at', { ascending: false }).limit(30)),
    ]);
    const vencendo = lotes.filter((l) => l.validade && l.validade <= daquiDias(60));
    const ROT_MOV = { entrada: 'Entrada', aberto: 'Frasco aberto', terminado: 'Terminado', descartado: 'Descartado', ajuste: 'Ajuste' };
    saldo.sort((a, b) => a.nome.localeCompare(b.nome));

    $('#conteudo').innerHTML = `
      <section class="cartao"><h2>Estoque</h2>
        ${saldo.length ? `<div class="tabela-rolagem"><table><thead><tr><th>Produto</th><th class="valor">Em estoque</th><th class="valor">Abertos</th><th class="valor">Mínimo</th><th></th><th>Ações</th></tr></thead><tbody>
          ${saldo.map((s) => `<tr><td>${esc(s.nome)}${s.marca ? ` <span class="legenda">${esc(s.marca)}</span>` : ''}</td>
            <td class="valor">${s.saldo}</td><td class="valor">${s.unidade === 'frasco' ? s.abertos : '-'}</td><td class="valor">${s.estoque_minimo}</td>
            <td>${s.saldo <= s.estoque_minimo ? '<span class="etiqueta erro">Repor</span>' : '<span class="etiqueta ok">OK</span>'}</td>
            <td><div class="linha-acoes">
              ${s.unidade === 'frasco'
                ? `<button class="btn peq sec" data-mov="aberto" data-prod="${s.produto_id}" ${s.saldo - s.abertos <= 0 ? 'disabled' : ''}>Abrir 1</button>
                   <button class="btn peq sec" data-mov="terminado" data-prod="${s.produto_id}" ${s.abertos <= 0 ? 'disabled' : ''}>Terminou 1</button>`
                : `<button class="btn peq sec" data-mov="terminado" data-prod="${s.produto_id}" ${s.saldo <= 0 ? 'disabled' : ''}>Usou 1</button>`}
              <button class="btn peq perigo" data-mov="descartado" data-prod="${s.produto_id}" ${s.saldo - s.abertos <= 0 ? 'disabled' : ''}>Descartar 1</button>
            </div></td></tr>`).join('')}
          </tbody></table></div>
          <p class="legenda">"Em estoque" conta fechados e abertos. Frasco: "Abrir 1" ao começar a usar e "Terminou 1" quando acabar. Seringa e outros: "Usou 1".</p>` : '<p class="vazio">Nenhum produto cadastrado.</p>'}
        ${vencendo.length ? `<h3>Lotes vencendo em até 60 dias</h3>${vencendo.map((l) => `<div><span class="etiqueta ${l.validade < hoje() ? 'erro' : 'alerta'}">${dataBR(l.validade)}</span> ${esc(nomeDe(E.ref.produtos, l.produto_id))}, lote ${esc(l.lote || '-')}, ${l.quantidade} un.</div>`).join('')}` : ''}
      </section>

      <section class="cartao"><h2>Chegou mercadoria</h2>
        <form id="f-entrada" class="form">
          <label>Produto<select name="produto_id" required>${opcoesLista(E.ref.produtos, null, 'Escolha')}</select></label>
          <label>Quantidade<input type="number" name="quantidade" min="1" value="1" required></label>
          <label>Lote<input name="lote"></label>
          <label>Validade<input type="date" name="validade"></label>
          <label>Custo de cada um<input name="custo_unitario" inputmode="decimal"></label>
          <label>Conferido por<input name="conferido_por"></label>
          <button class="btn" type="submit">Dar entrada</button>
        </form>
      </section>

      <section class="cartao"><details><summary>Cadastrar produto novo</summary>
        <form id="f-produto" class="form">
          <label>Nome<input name="nome" required placeholder="ex.: Toxina botulínica 100 U"></label>
          <label>Marca<input name="marca"></label>
          <label>Fornecedor<select name="fornecedor_id">${opcoesLista(E.ref.fornecedores, null, 'Nenhum')}</select></label>
          <label>Unidade<select name="unidade"><option>frasco</option><option>seringa</option><option>caixa</option><option>unidade</option></select></label>
          <label>Conteúdo (ex.: 200)<input name="conteudo" inputmode="decimal"></label>
          <label>Medida (ex.: U, ml)<input name="unidade_conteudo"></label>
          <label>Custo de compra<input name="custo" inputmode="decimal"></label>
          <label>Estoque mínimo<input type="number" name="estoque_minimo" min="0" value="1"></label>
          <button class="btn" type="submit">Cadastrar</button>
        </form></details></section>

      <section class="cartao"><h2>Últimos movimentos</h2>
        ${movs.length ? `<div class="tabela-rolagem"><table><tbody>${movs.map((m) => `<tr><td>${dataBR(m.data)}</td><td>${esc(ROT_MOV[m.tipo])}</td><td>${esc(nomeDe(E.ref.produtos, m.produto_id))}</td><td class="valor">${m.quantidade}</td><td class="legenda">${esc(m.observacao || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="vazio">Nenhum movimento ainda.</p>'}
      </section>`;

    $$('[data-mov]').forEach((b) => { b.onclick = async () => {
      const tipo = b.dataset.mov;
      let obs = null;
      if (tipo === 'descartado') { obs = prompt('Motivo do descarte (ex.: vencido, quebrou):'); if (obs === null) return; }
      b.disabled = true;
      await q(E.cli.from('movimentos_estoque').insert({ produto_id: b.dataset.prod, tipo, quantidade: 1, data: hoje(), observacao: obs }));
      recarregar();
    }; });
    $('#f-entrada').onsubmit = async (ev) => {
      ev.preventDefault();
      const d = dadosForm(ev.target);
      const qtd = Math.max(1, parseInt(d.quantidade, 10) || 1);
      const custo = num(d.custo_unitario);
      const lote = await q(E.cli.from('lotes').insert({
        produto_id: d.produto_id, lote: d.lote || null, validade: d.validade || null, quantidade: qtd, custo_unitario: custo, conferido_por: d.conferido_por || null,
      }).select());
      await q(E.cli.from('movimentos_estoque').insert({ produto_id: d.produto_id, lote_id: lote[0].id, tipo: 'entrada', quantidade: qtd, data: hoje() }));
      if (custo != null) await q(E.cli.from('produtos').update({ custo }).eq('id', d.produto_id));
      avisar('Entrada registrada.'); await carregarReferencias(); recarregar();
    };
    $('#f-produto').onsubmit = async (ev) => {
      ev.preventDefault();
      const d = dadosForm(ev.target);
      await q(E.cli.from('produtos').insert({
        nome: d.nome.trim(), marca: d.marca || null, fornecedor_id: d.fornecedor_id || null, unidade: d.unidade,
        conteudo: num(d.conteudo), unidade_conteudo: d.unidade_conteudo || null, custo: num(d.custo), estoque_minimo: parseInt(d.estoque_minimo, 10) || 0,
      }));
      avisar('Produto cadastrado.'); await carregarReferencias(); recarregar();
    };
  }

  // ---------- REPASSES ----------
  async function telaRepasses() {
    const ym = E.mesRepasses;
    const parceiros = E.ref.profissionais.filter((p) => p.e_parceiro);
    const [doMes, abertos] = await Promise.all([
      q(E.cli.from('repasses').select('*').gte('data', inicioMes(ym)).lt('data', fimMesExcl(ym)).order('data', { ascending: false })),
      q(E.cli.from('repasses').select('*').eq('recebido', false)),
    ]);
    const percDe = (prof, tipo) => (prof ? Number(prof['perc_' + tipo]) : { consulta: 30, cirurgico: 40, laser: 60 }[tipo]);

    $('#conteudo').innerHTML = `
      <section class="cartao"><h2>A receber dos médicos</h2>
        ${parceiros.map((p) => { const a = abertos.filter((r) => r.profissional_id === p.id); return `<div>${esc(p.nome)}: <b>${brl(soma(a, (r) => r.valor_devido))}</b> <span class="legenda">(${a.length} em aberto)</span></div>`; }).join('') || '<p class="vazio">Nenhum médico parceiro cadastrado.</p>'}
      </section>

      <section class="cartao"><h2>Novo atendimento de médico parceiro</h2>
        <form id="f-rep" class="form">
          <label>Data<input type="date" name="data" value="${hoje()}" required></label>
          <label>Médico<select name="profissional_id" required>${opcoesLista(parceiros, parceiros[0] && parceiros[0].id)}</select></label>
          <label>Paciente<input name="paciente"></label>
          <label>Tipo<select name="tipo">${opcoes(ROTULO_TIPO, 'consulta')}</select></label>
          <label>Valor cobrado<input name="valor_bruto" inputmode="decimal" required></label>
          <label>Imposto<input name="imposto" inputmode="decimal" value="0"></label>
          <label>Material<input name="material" inputmode="decimal" value="0"></label>
          <label>Percentual da clínica<input name="percentual" inputmode="decimal" value="${percDe(parceiros[0], 'consulta')}"></label>
          <div class="largo legenda" id="rep-previa"></div>
          <button class="btn" type="submit">Lançar</button>
        </form>
      </section>

      <section class="cartao"><h2>Atendimentos de ${esc(nomeMes(ym).toLowerCase())}</h2>
        <div class="filtros"><label>Mês <input type="month" id="r-mes" value="${ym}"></label></div>
        ${doMes.length ? `<div class="tabela-rolagem"><table><thead><tr><th>Data</th><th>Médico</th><th>Paciente</th><th>Tipo</th><th class="valor">Cobrado</th><th class="valor">Base</th><th class="valor">%</th><th class="valor">Clínica</th><th>Recebido</th><th></th></tr></thead><tbody>
          ${doMes.map((r) => `<tr><td>${dataBR(r.data)}</td><td>${esc(nomeDe(E.ref.profissionais, r.profissional_id))}</td><td>${esc(r.paciente || '')}</td><td>${esc(ROTULO_TIPO[r.tipo])}</td>
            <td class="valor">${brl(r.valor_bruto)}</td><td class="valor">${brl(r.valor_bruto - r.imposto - r.material)}</td><td class="valor">${Number(r.percentual)}%</td>
            <td class="valor"><b>${brl(r.valor_devido)}</b></td>
            <td><input type="checkbox" data-recebido="${r.id}" ${r.recebido ? 'checked' : ''} style="width:auto"></td>
            <td><button class="btn peq perigo" data-apagar-rep="${r.id}">Apagar</button></td></tr>`).join('')}
          <tr class="total"><td colspan="7">Total</td><td class="valor">${brl(soma(doMes, (r) => r.valor_devido))}</td><td colspan="2"></td></tr>
          </tbody></table></div>` : '<p class="vazio">Nenhum atendimento lançado.</p>'}
      </section>`;

    const f = $('#f-rep');
    const previa = () => {
      const base = (num(f.valor_bruto.value) || 0) - (num(f.imposto.value) || 0) - (num(f.material.value) || 0);
      const pct = num(f.percentual.value) || 0;
      $('#rep-previa').textContent = `Base ${brl(base)} × ${pct}% = clínica recebe ${brl(Math.round(base * pct) / 100)}`;
    };
    const ajustarPerc = () => { f.percentual.value = percDe(porId(parceiros, f.profissional_id.value), f.tipo.value); previa(); };
    f.tipo.onchange = ajustarPerc; f.profissional_id.onchange = ajustarPerc;
    ['valor_bruto', 'imposto', 'material', 'percentual'].forEach((n) => { f[n].oninput = previa; });
    previa();
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const d = dadosForm(f);
      const bruto = num(d.valor_bruto);
      if (bruto == null) return avisar('Valor inválido.');
      await q(E.cli.from('repasses').insert({
        data: d.data, profissional_id: d.profissional_id, paciente: d.paciente || null, tipo: d.tipo,
        valor_bruto: bruto, imposto: num(d.imposto) || 0, material: num(d.material) || 0, percentual: num(d.percentual) || 0,
      }));
      avisar('Atendimento lançado.'); recarregar();
    };
    $('#r-mes').onchange = (ev) => { if (ev.target.value) { E.mesRepasses = ev.target.value; recarregar(); } };
    $$('[data-recebido]').forEach((c) => { c.onchange = async () => {
      await q(E.cli.from('repasses').update({ recebido: c.checked, recebido_em: c.checked ? hoje() : null }).eq('id', c.dataset.recebido)); recarregar();
    }; });
    $$('[data-apagar-rep]').forEach((b) => { b.onclick = async () => {
      if (!confirm('Apagar este atendimento?')) return;
      await q(E.cli.from('repasses').delete().eq('id', b.dataset.apagarRep)); recarregar();
    }; });
  }

  const TELAS = { painel: telaPainel, caixa: telaCaixa, contas: telaContas, estoque: telaEstoque, repasses: telaRepasses };

  iniciar().catch((e) => { console.error(e); $('#conteudo').innerHTML = '<p class="vazio">Não foi possível iniciar o app.</p>'; });
})();
