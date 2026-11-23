// Modo demonstração (?demo=1): usa o banco de verdade, mas só as tabelas demo_* (dados fictícios),
// sem login. As tabelas reais da clínica continuam fechadas por login e papel.
(function () {
  window.criarClienteDemo = function () {
    const base = window.supabase.createClient(window.CLINICA_CONFIG.url, window.CLINICA_CONFIG.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const sessao = { user: { id: 'demo', email: 'Demonstração' } };
    return {
      demo: true,
      from: (tabela) => base.from('demo_' + tabela),
      rpc: async (nome) => (nome === 'meu_papel' ? { data: 'admin', error: null } : base.rpc('demo_' + nome)),
      auth: {
        getSession: async () => ({ data: { session: sessao }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => { location.href = location.pathname; return { error: null }; },
        signInWithOtp: async () => ({ error: null }),
      },
      async reiniciar() {
        if (!confirm('Voltar aos dados de exemplo? Tudo o que foi lançado na demonstração será apagado.')) return;
        const { error } = await base.rpc('demo_reiniciar');
        if (error) { alert('Não foi possível reiniciar: ' + error.message); return; }
        location.reload();
      },
    };
  };
})();
