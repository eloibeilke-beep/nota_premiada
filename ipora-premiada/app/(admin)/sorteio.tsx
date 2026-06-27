import { getItem } from '@/src/storage';
import { apiUrl } from '@/src/api';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert, FlatList, SectionList, StyleSheet, Text,
  TouchableOpacity, View, ScrollView, ActivityIndicator,
} from 'react-native';

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

type Ganhador = {
  id?: string;
  numeroCupom: number;
  nomeUsuario: string;
  cpfUsuario: string;
  razaoSocial: string;
  mesAno: string;
  tipo: string;
  tipoNota?: string;
  mes?: number;
  ano?: number;
  posicao?: number;
  realizadoEm?: string;
};

type Secao = { titulo: string; data: Ganhador[] };

// Opções do filtro de histórico: 'anual' | número do mês (1-12)
type FiltroHistorico = 'anual' | number;

export default function SorteioScreen() {
  const router = useRouter();
  const [ultimoResultado, setUltimoResultado] = useState<Ganhador[]>([]);
  const [todosGanhadores, setTodosGanhadores] = useState<Ganhador[]>([]);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [tipo, setTipo] = useState<'mensal' | 'anual'>('mensal');
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado] = useState(new Date().getFullYear());
  const [carregando, setCarregando] = useState(false);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'sortear' | 'historico'>('sortear');
  const [proximaPosicao, setProximaPosicao] = useState(1);
  const [lugarSelecionado, setLugarSelecionado] = useState(1);
  const [quantidadeSorteios, setQuantidadeSorteios] = useState(10);
  const [carregandoConfig, setCarregandoConfig] = useState(true);

  // Filtro ativo no histórico: 'anual' ou número do mês
  const [filtroHistorico, setFiltroHistorico] = useState<FiltroHistorico>(new Date().getMonth() + 1);

  const carregarConfiguracaoSorteios = async () => {
    try {
      const cpf = await getItem('cpf');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(apiUrl(`/admin/configuracao-sorteios?cpfAdmin=${cpf}`), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setQuantidadeSorteios(json.quantidadeSorteios || 10);
    } catch (e) {
      console.error('Erro ao carregar config de sorteios:', e);
      setQuantidadeSorteios(10);
    } finally {
      setCarregandoConfig(false);
    }
  };

  const buscarHistorico = async () => {
    setCarregandoHistorico(true);
    try {
      const cpf = await getItem('cpf');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(apiUrl(`/admin/historico-sorteios?cpfAdmin=${cpf}`), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json: Ganhador[] = await res.json();

      setTodosGanhadores(json);

      // Calcula próxima posição para o período atual (aba sortear)
      const doMes = json.filter(g =>
        g.tipo === tipo &&
        g.ano === anoSelecionado &&
        (tipo === 'anual' || g.mes === mesSelecionado)
      );
      setProximaPosicao(doMes.length + 1);
      setLugarSelecionado(doMes.length + 1);

      atualizarSecoes(json, filtroHistorico);
    } catch (e) {
      console.error('Erro ao buscar histórico:', e);
    } finally {
      setCarregandoHistorico(false);
    }
  };

  // Reconstrói as seções baseado no filtro escolhido
  const atualizarSecoes = (ganhadores: Ganhador[], filtro: FiltroHistorico) => {
    let filtrados: Ganhador[];

    if (filtro === 'anual') {
      filtrados = ganhadores.filter(g => g.tipo === 'anual' && g.ano === anoSelecionado);
    } else {
      filtrados = ganhadores.filter(
        g => g.tipo === 'mensal' && g.ano === anoSelecionado && g.mes === filtro
      );
    }

    if (filtrados.length === 0) {
      setSecoes([]);
      return;
    }

    const titulo = filtro === 'anual'
      ? `🏆 Sorteio Anual — ${anoSelecionado}`
      : `📅 ${MESES[filtro - 1]} ${anoSelecionado}`;

    setSecoes([{
      titulo,
      data: filtrados.sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0)),
    }]);
  };

  const mudarFiltro = (filtro: FiltroHistorico) => {
    setFiltroHistorico(filtro);
    atualizarSecoes(todosGanhadores, filtro);
  };

  const apagarSorteio = async (id: string) => {
    Alert.alert('Apagar sorteio', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar', style: 'destructive', onPress: async () => {
          const cpf = await getItem('cpf');
          await fetch(apiUrl(`/admin/sorteio/${id}?cpfAdmin=${cpf}`), { method: 'DELETE' });
          buscarHistorico();
        },
      },
    ]);
  };

  const apagarTodos = async () => {
    Alert.alert('Apagar todos', 'Apagar todo o histórico de sorteios?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar tudo', style: 'destructive', onPress: async () => {
          const cpf = await getItem('cpf');
          await fetch(apiUrl(`/admin/sorteios?cpfAdmin=${cpf}`), { method: 'DELETE' });
          setTodosGanhadores([]);
          setSecoes([]);
        },
      },
    ]);
  };

  useEffect(() => { carregarConfiguracaoSorteios(); }, []);
  useEffect(() => { buscarHistorico(); }, [tipo, mesSelecionado, anoSelecionado]);

  const publicarResultados = async (publicar: boolean) => {
    try {
      const cpf = await getItem('cpf');
      const res = await fetch(apiUrl('/admin/publicar-resultado'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpfAdmin: cpf,
          tipo,
          mes: mesSelecionado,
          ano: anoSelecionado,
          publicar,
        }),
      });
      const json = await res.json();
      if (!res.ok) { Alert.alert('Erro', json.detail); return; }
      Alert.alert('Sucesso', json.mensagem);
    } catch {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    }
  };

  const realizarSorteio = async () => {
    Alert.alert(
      'Confirmar sorteio',
      `Sortear o ${lugarSelecionado}º lugar — ${tipo === 'mensal' ? `${MESES[mesSelecionado - 1]}/${anoSelecionado}` : `Anual ${anoSelecionado}`}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sortear!', onPress: async () => {
            setCarregando(true);
            try {
              const cpf = await getItem('cpf');
              const res = await fetch(apiUrl('/admin/sortear'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  cpfAdmin: cpf, tipo, mes: mesSelecionado,
                  ano: anoSelecionado, quantidade: 1, lugar: lugarSelecionado,
                }),
              });
              const json = await res.json();
              if (!res.ok) { Alert.alert('Erro', json.detail); return; }
              setUltimoResultado(json.ganhadores);
              setProximaPosicao(json.proximaPosicao ?? 1);
              setLugarSelecionado(json.proximaPosicao ?? 1);
              buscarHistorico();
            } catch {
              Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
            } finally {
              setCarregando(false);
            }
          },
        },
      ]
    );
  };

  const renderGanhador = (g: Ganhador, destaque = false) => {
    const ehServico = g.tipoNota === 'servico';
    const tipoCerto = g.tipoNota === 'servico' || g.tipoNota === 'produto';
    return (
      <View key={`${g.numeroCupom}-${g.posicao}`} style={[
        styles.cardGanhador,
        destaque && styles.cardDestaque,
        ehServico && styles.cardServico,
        destaque && ehServico && styles.cardDestaqueServico,
      ]}>
        <View style={[
          styles.posicaoBadge,
          destaque && styles.posicaoBadgeDestaque,
          ehServico && !destaque && styles.posicaoBadgeServico,
          destaque && ehServico && styles.posicaoBadgeDestaqueServico,
        ]}>
          <Text style={styles.posicaoTexto}>{g.posicao}º</Text>
        </View>
        <View style={styles.ganhadorInfo}>
          {/* Tag de tipo — sempre visível */}
          {tipoCerto ? (
            <View style={[styles.tagTipo, ehServico ? styles.tagServico : styles.tagProduto]}>
              <Text style={styles.tagTipoTexto}>
                {ehServico ? '🔧 SERVIÇO' : '🛒 PRODUTO'}
              </Text>
            </View>
          ) : (
            <View style={[styles.tagTipo, styles.tagDesconhecido]}>
              <Text style={styles.tagTipoTexto}>📄 SORTEIO ANTERIOR</Text>
            </View>
          )}
          <View style={[styles.cupomDestaque, ehServico && styles.cupomDestaqueServico]}>
            <Text style={[styles.cupomNumero, ehServico && styles.cupomNumeroServico]}>
              #{String(g.numeroCupom).padStart(6, '0')}
            </Text>
          </View>
          <Text style={styles.ganhadorNome}>{g.nomeUsuario}</Text>
          <Text style={styles.ganhadorDetalhe}>CPF: {g.cpfUsuario}</Text>
          <Text style={styles.ganhadorDetalhe}>🏢 {g.razaoSocial}</Text>
        </View>
        {!destaque && g.id && (
          <TouchableOpacity onPress={() => apagarSorteio(g.id!)} style={styles.btnApagar}>
            <Text>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Filtros do histórico ──────────────────────────────────────────────────
  const renderFiltrosHistorico = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={true}
      persistentScrollbar={true}
      style={styles.filtrosScroll}
      contentContainerStyle={styles.filtrosContainer}>
      {/* Botão Anual */}
      <TouchableOpacity
        style={[styles.filtroBotao, filtroHistorico === 'anual' && styles.filtroBotaoAtivo]}
        onPress={() => mudarFiltro('anual')}>
        <Text style={[styles.filtroTexto, filtroHistorico === 'anual' && styles.filtroTextoAtivo]}>
          🏆 Anual
        </Text>
      </TouchableOpacity>

      {/* Botões por mês */}
      {MESES.map((m, i) => {
        const mes = i + 1;
        const ativo = filtroHistorico === mes;
        const temDados = todosGanhadores.some(
          g => g.tipo === 'mensal' && g.ano === anoSelecionado && g.mes === mes
        );
        return (
          <TouchableOpacity
            key={mes}
            style={[styles.filtroBotao, ativo && styles.filtroBotaoAtivo, !temDados && styles.filtroBotaoVazio]}
            onPress={() => mudarFiltro(mes)}>
            <Text style={[styles.filtroTexto, ativo && styles.filtroTextoAtivo, !temDados && styles.filtroTextoVazio]}>
              {m.slice(0, 3)}
              {temDados && !ativo ? ' ●' : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Abas e Configuração */}
      <View style={styles.topoContainer}>
        <View style={styles.abas}>
          <TouchableOpacity
            style={[styles.aba, abaAtiva === 'sortear' && styles.abaAtiva]}
            onPress={() => setAbaAtiva('sortear')}>
            <Text style={[styles.abaTexto, abaAtiva === 'sortear' && styles.abaTextoAtivo]}>🎲 Realizar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.aba, abaAtiva === 'historico' && styles.abaAtiva]}
            onPress={() => { setAbaAtiva('historico'); buscarHistorico(); }}>
            <Text style={[styles.abaTexto, abaAtiva === 'historico' && styles.abaTextoAtivo]}>📋 Histórico</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.btnConfigurar}
          onPress={() => router.push('/(admin)/configuracao' as any)}>
          <Text style={styles.btnConfigurarTexto}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* ── ABA SORTEAR ── */}
      {abaAtiva === 'sortear' ? (
        <FlatList
          data={ultimoResultado}
          keyExtractor={(_, i) => String(i)}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <Text style={styles.secaoTitulo}>Tipo de sorteio</Text>
              <View style={styles.row}>
                {(['mensal', 'anual'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.opcao, tipo === t && styles.opcaoAtiva]}
                    onPress={() => { setTipo(t); setUltimoResultado([]); setProximaPosicao(1); }}>
                    <Text style={[styles.opcaoTexto, tipo === t && styles.opcaoTextoAtivo]}>
                      {t === 'mensal' ? '📅 Mensal' : '🏆 Anual'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tipo === 'mensal' && (
                <>
                  <Text style={styles.secaoTitulo}>Mês</Text>
                  <View style={styles.mesesGrid}>
                    {MESES.map((m, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.mesOpcao, mesSelecionado === i + 1 && styles.mesAtivo]}
                        onPress={() => { setMesSelecionado(i + 1); setUltimoResultado([]); setProximaPosicao(1); }}>
                        <Text style={[styles.mesTexto, mesSelecionado === i + 1 && styles.mesTextoAtivo]}>
                          {m.slice(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.secaoTitulo}>Lugar do sorteio</Text>
              <View style={styles.row}>
                {Array.from({ length: quantidadeSorteios }, (_, i) => i + 1).map(l => {
                  const jaSorteado = todosGanhadores.some(g =>
                    g.posicao === l &&
                    g.tipo === tipo &&
                    g.ano === anoSelecionado &&
                    (tipo === 'anual' || g.mes === mesSelecionado)
                  );
                  return (
                    <TouchableOpacity
                      key={l}
                      style={[
                        styles.lugarOpcao,
                        lugarSelecionado === l && styles.lugarAtivo,
                        jaSorteado && styles.lugarSorteado,
                      ]}
                      onPress={() => !jaSorteado && setLugarSelecionado(l)}
                      disabled={jaSorteado}>
                      <Text style={[
                        styles.lugarTexto,
                        lugarSelecionado === l && styles.lugarTextoAtivo,
                        jaSorteado && styles.lugarTextoSorteado,
                      ]}>{l}º</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.botaoSortear} onPress={realizarSorteio} disabled={carregando}>
                <Text style={styles.botaoSortearTexto}>
                  {carregando ? 'Sorteando...' : `🎲 Sortear ${lugarSelecionado}º lugar`}
                </Text>
              </TouchableOpacity>

              {ultimoResultado.length > 0 && (
                <Text style={styles.resultadoTitulo}>🎉 Último resultado</Text>
              )}
            </View>
          }
          renderItem={({ item }) => renderGanhador(item, true)}
        />
      ) : (
        /* ── ABA HISTÓRICO ── */
        <View style={styles.flex}>
          {/* Filtros de período */}
          {renderFiltrosHistorico()}

          {/* Botões de publicação */}
          <View style={styles.publicarRow}>
            <TouchableOpacity
              style={styles.btnPublicar}
              onPress={() => Alert.alert(
                'Publicar resultados',
                `Publicar ganhadores de ${tipo === 'anual' ? `Anual ${anoSelecionado}` : `${MESES[mesSelecionado - 1]} ${anoSelecionado}`} para todos os usuários?`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Publicar', onPress: () => publicarResultados(true) },
                ]
              )}>
              <Text style={styles.btnPublicarTexto}>📢 Publicar resultados</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnDespublicar}
              onPress={() => Alert.alert(
                'Ocultar resultados',
                `Ocultar ganhadores de ${tipo === 'anual' ? `Anual ${anoSelecionado}` : `${MESES[mesSelecionado - 1]} ${anoSelecionado}`}?`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Ocultar', style: 'destructive', onPress: () => publicarResultados(false) },
                ]
              )}>
              <Text style={styles.btnDespublicarTexto}>🔒 Ocultar</Text>
            </TouchableOpacity>
          </View>

          {carregandoHistorico ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#1b5e20" />
            </View>
          ) : (
            <SectionList
              sections={secoes}
              keyExtractor={(item, i) => `${item.numeroCupom}-${i}`}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                secoes.length > 0 ? (
                  <TouchableOpacity style={styles.btnApagarTodos} onPress={apagarTodos}>
                    <Text style={styles.btnApagarTodosTexto}>🗑️ Apagar todo o histórico</Text>
                  </TouchableOpacity>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.vazioContainer}>
                  <Text style={styles.vazioIcone}>
                    {filtroHistorico === 'anual' ? '🏆' : '📅'}
                  </Text>
                  <Text style={styles.vazio}>
                    {filtroHistorico === 'anual'
                      ? `Nenhum sorteio anual realizado em ${anoSelecionado}.`
                      : `Nenhum sorteio realizado em ${MESES[(filtroHistorico as number) - 1]} ${anoSelecionado}.`}
                  </Text>
                </View>
              }
              renderSectionHeader={({ section }) => (
                <View style={styles.secaoHeader}>
                  <Text style={styles.secaoHeaderTexto}>{section.titulo}</Text>
                  <Text style={styles.secaoHeaderCount}>
                    {section.data.length} ganhador{section.data.length !== 1 ? 'es' : ''}
                  </Text>
                </View>
              )}
              renderItem={({ item }) => renderGanhador(item, false)}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topoContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  abas: { flex: 1, flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#1b5e20' },
  aba: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#fff' },
  abaAtiva: { backgroundColor: '#1b5e20' },
  abaTexto: { fontWeight: '600', color: '#1b5e20', fontSize: 14 },
  abaTextoAtivo: { color: '#fff' },
  btnConfigurar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1b5e20', alignItems: 'center', justifyContent: 'center' },
  btnConfigurarTexto: { fontSize: 20 },

  // Filtros do histórico
  filtrosScroll: { marginBottom: 12 },
  filtrosContainer: { flexDirection: 'row', gap: 8, paddingBottom: 4, paddingHorizontal: 2 },
  filtroBotao: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 2, borderColor: '#1b5e20',
    backgroundColor: '#fff',
    minWidth: 70,
    alignItems: 'center',
  },
  filtroBotaoAtivo: { backgroundColor: '#1b5e20' },
  filtroBotaoVazio: { borderColor: '#e0e0e0' },
  filtroTexto: { fontSize: 13, fontWeight: '700', color: '#1b5e20' },
  filtroTextoAtivo: { color: '#fff' },
  filtroTextoVazio: { color: '#bbb' },

  secaoTitulo: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8, marginTop: 12 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  opcao: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e0e0e0', alignItems: 'center', backgroundColor: '#fff' },
  opcaoAtiva: { borderColor: '#1b5e20', backgroundColor: '#e8f5e9' },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: '#888' },
  opcaoTextoAtivo: { color: '#1b5e20' },

  lugarOpcao: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  lugarAtivo: { borderColor: '#1b5e20', backgroundColor: '#1b5e20' },
  lugarSorteado: { backgroundColor: '#f5f5f5', borderColor: '#e0e0e0', opacity: 0.4 },
  lugarTexto: { fontSize: 12, fontWeight: '700', color: '#555' },
  lugarTextoAtivo: { color: '#fff' },
  lugarTextoSorteado: { color: '#bbb' },

  mesesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  mesOpcao: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0' },
  mesAtivo: { backgroundColor: '#1b5e20', borderColor: '#1b5e20' },
  mesTexto: { fontSize: 13, color: '#555', fontWeight: '600' },
  mesTextoAtivo: { color: '#fff' },

  botaoSortear: { backgroundColor: '#1b5e20', padding: 16, borderRadius: 12, alignItems: 'center', marginVertical: 16 },
  botaoSortearTexto: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  resultadoTitulo: { fontSize: 16, fontWeight: 'bold', color: '#1b5e20', marginBottom: 8 },

  cardGanhador: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', gap: 12, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#1b5e20' },
  cardDestaque: { borderLeftColor: '#f9a825', backgroundColor: '#fffde7' },
  cardServico: { borderLeftColor: '#1565c0', backgroundColor: '#f0f7ff' },
  cardDestaqueServico: { borderLeftColor: '#1565c0', backgroundColor: '#e3f2fd' },
  posicaoBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1b5e20', alignItems: 'center', justifyContent: 'center' },
  posicaoBadgeDestaque: { backgroundColor: '#f9a825' },
  posicaoBadgeServico: { backgroundColor: '#1565c0' },
  posicaoBadgeDestaqueServico: { backgroundColor: '#0d47a1' },
  posicaoTexto: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  ganhadorInfo: { flex: 1 },
  tagServico: { backgroundColor: '#1565c0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 },
  tagServicoTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },
  tagTipo: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 },
  tagProduto: { backgroundColor: '#2e7d32' },
  tagDesconhecido: { backgroundColor: '#9e9e9e' },
  tagTipoTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cupomDestaque: { backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 },
  cupomDestaqueServico: { backgroundColor: '#dbeafe' },
  cupomNumero: { color: '#1b5e20', fontWeight: 'bold', fontSize: 15, letterSpacing: 2 },
  cupomNumeroServico: { color: '#1565c0' },
  ganhadorNome: { fontSize: 14, fontWeight: '700', color: '#333' },
  ganhadorDetalhe: { fontSize: 12, color: '#777', marginTop: 1 },
  btnApagar: { padding: 4, alignSelf: 'flex-start' },

  secaoHeader: { backgroundColor: '#e8f5e9', padding: 12, borderLeftWidth: 4, borderLeftColor: '#1b5e20', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderRadius: 6 },
  secaoHeaderTexto: { fontSize: 14, fontWeight: '700', color: '#1b5e20' },
  secaoHeaderCount: { fontSize: 12, color: '#555' },

  btnApagarTodos: { backgroundColor: '#ffebee', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  btnApagarTodosTexto: { color: '#c62828', fontWeight: '600', fontSize: 13 },

  vazioContainer: { alignItems: 'center', marginTop: 48, gap: 8 },
  vazioIcone: { fontSize: 40 },
  vazio: { textAlign: 'center', color: '#888', fontSize: 15 },

  // Publicar resultados
  publicarRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  btnPublicar: {
    flex: 1,
    backgroundColor: '#f9a825',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPublicarTexto: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  btnDespublicar: {
    flex: 0,
    backgroundColor: '#ffebee',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  btnDespublicarTexto: { color: '#c62828', fontWeight: '600', fontSize: 12, textAlign: 'center' },
});
