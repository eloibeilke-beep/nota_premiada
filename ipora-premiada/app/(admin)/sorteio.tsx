import { getItem } from '@/src/storage';
import { useEffect, useState } from 'react';
import { Alert, FlatList, SectionList, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';

const API_URL = 'http://192.168.3.51:8000';
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type Ganhador = {
  id?: string;
  numeroCupom: number;
  nomeUsuario: string;
  cpfUsuario: string;
  razaoSocial: string;
  mesAno: string;
  tipo: string;
  mes?: number;
  ano?: number;
  posicao?: number;
  realizadoEm?: string;
};

type Secao = { titulo: string; data: Ganhador[] };

export default function SorteioScreen() {
  const [ultimoResultado, setUltimoResultado] = useState<Ganhador[]>([]);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [tipo, setTipo] = useState<'mensal' | 'anual'>('mensal');
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado] = useState(new Date().getFullYear());
  const [carregando, setCarregando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'sortear' | 'historico'>('sortear');
  const [proximaPosicao, setProximaPosicao] = useState(1);
  const [lugarSelecionado, setLugarSelecionado] = useState(1);

  const buscarHistorico = async () => {
    try {
      const cpf = await getItem('cpf');
      const res = await fetch(`${API_URL}/admin/historico-sorteios?cpfAdmin=${cpf}`);
      const json: Ganhador[] = await res.json();

      // Calcula próxima posição para o período atual
      const doMes = json.filter(g =>
        g.tipo === tipo &&
        g.ano === anoSelecionado &&
        (tipo === 'anual' || g.mes === mesSelecionado)
      );
      const proxima = doMes.length + 1;
      setProximaPosicao(proxima);
      setLugarSelecionado(proxima);

      // Agrupa por mês/ano e tipo
      const grupos: Record<string, Ganhador[]> = {};
      json.forEach(g => {
        const chave = g.tipo === 'anual'
          ? `🏆 Sorteio Anual — ${g.ano}`
          : `📅 ${MESES[(g.mes ?? 1) - 1]} ${g.ano}`;
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push(g);
      });

      const secoesOrdenadas = Object.entries(grupos)
        .map(([titulo, data]) => ({
          titulo,
          data: data.sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0)),
        }));

      setSecoes(secoesOrdenadas);
    } catch (e) {
      console.log(e);
    }
  };

  const apagarSorteio = async (id: string) => {
    Alert.alert('Apagar sorteio', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => {
        const cpf = await getItem('cpf');
        await fetch(`${API_URL}/admin/sorteio/${id}?cpfAdmin=${cpf}`, { method: 'DELETE' });
        buscarHistorico();
      }}
    ]);
  };

  const apagarTodos = async () => {
    Alert.alert('Apagar todos', 'Apagar todo o histórico de sorteios?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar tudo', style: 'destructive', onPress: async () => {
        const cpf = await getItem('cpf');
        await fetch(`${API_URL}/admin/sorteios?cpfAdmin=${cpf}`, { method: 'DELETE' });
        setSecoes([]);
        buscarHistorico();
      }}
    ]);
  };

  useEffect(() => { setUltimoResultado([]); buscarHistorico(); }, [tipo, mesSelecionado, anoSelecionado]);

  const realizarSorteio = async () => {
    Alert.alert(
      'Confirmar sorteio',
      `Sortear o ${proximaPosicao}º lugar — ${tipo === 'mensal' ? `${MESES[mesSelecionado - 1]}/${anoSelecionado}` : `Anual ${anoSelecionado}`}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sortear!', onPress: async () => {
          setCarregando(true);
          try {
            const cpf = await getItem('cpf');
            const res = await fetch(`${API_URL}/admin/sortear`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cpfAdmin: cpf, tipo, mes: mesSelecionado, ano: anoSelecionado, quantidade: 1, lugar: lugarSelecionado }),
            });
            const json = await res.json();
            if (!res.ok) { Alert.alert('Erro', json.detail); return; }
            setUltimoResultado(json.ganhadores);
            setProximaPosicao(json.proximaPosicao ?? 1);
            buscarHistorico();
          } catch {
            Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
          } finally {
            setCarregando(false);
          }
        }}
      ]
    );
  };

  const renderGanhador = (g: Ganhador, destaque = false) => (
    <View key={g.numeroCupom} style={[styles.cardGanhador, destaque && styles.cardDestaque]}>
      <View style={styles.posicaoBadge}>
        <Text style={styles.posicaoTexto}>{g.posicao}º</Text>
      </View>
      <View style={styles.ganhadorInfo}>
        <View style={styles.cupomDestaque}>
          <Text style={styles.cupomNumero}>#{String(g.numeroCupom).padStart(6, '0')}</Text>
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

  return (
    <View style={styles.container}>
      {/* Abas */}
      <View style={styles.abas}>
        <TouchableOpacity style={[styles.aba, abaAtiva === 'sortear' && styles.abaAtiva]} onPress={() => setAbaAtiva('sortear')}>
          <Text style={[styles.abaTexto, abaAtiva === 'sortear' && styles.abaTextoAtivo]}>🎲 Realizar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.aba, abaAtiva === 'historico' && styles.abaAtiva]} onPress={() => setAbaAtiva('historico')}>
          <Text style={[styles.abaTexto, abaAtiva === 'historico' && styles.abaTextoAtivo]}>📋 Histórico</Text>
        </TouchableOpacity>
      </View>

      {abaAtiva === 'sortear' ? (
        <FlatList
          data={ultimoResultado}
          keyExtractor={(_, i) => String(i)}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Tipo */}
              <Text style={styles.secaoTitulo}>Tipo de sorteio</Text>
              <View style={styles.row}>
                {(['mensal', 'anual'] as const).map(t => (
                  <TouchableOpacity key={t} style={[styles.opcao, tipo === t && styles.opcaoAtiva]} onPress={() => { setTipo(t); setUltimoResultado([]); setProximaPosicao(1); }}>
                    <Text style={[styles.opcaoTexto, tipo === t && styles.opcaoTextoAtivo]}>
                      {t === 'mensal' ? '📅 Mensal' : '🏆 Anual'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Meses */}
              {tipo === 'mensal' && (
                <>
                  <Text style={styles.secaoTitulo}>Mês</Text>
                  <View style={styles.mesesGrid}>
                    {MESES.map((m, i) => (
                      <TouchableOpacity key={i} style={[styles.mesOpcao, mesSelecionado === i + 1 && styles.mesAtivo]} onPress={() => { setMesSelecionado(i + 1); setUltimoResultado([]); setProximaPosicao(1); }}>
                        <Text style={[styles.mesTexto, mesSelecionado === i + 1 && styles.mesTextoAtivo]}>{m.slice(0, 3)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Lugar */}
              <Text style={styles.secaoTitulo}>Lugar do sorteio</Text>
              <View style={styles.row}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(l => {
                  const jaSorteado = secoes.some(s =>
                    s.data.some(g => g.posicao === l &&
                      g.tipo === tipo &&
                      g.ano === anoSelecionado &&
                      (tipo === 'anual' || g.mes === mesSelecionado)
                    )
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
          ListEmptyComponent={<Text style={styles.vazio}>Nenhum sorteio realizado ainda.</Text>}
          renderSectionHeader={({ section }) => (
            <View style={styles.secaoHeader}>
              <Text style={styles.secaoHeaderTexto}>{section.titulo}</Text>
              <Text style={styles.secaoHeaderCount}>{section.data.length} ganhador{section.data.length !== 1 ? 'es' : ''}</Text>
            </View>
          )}
          renderItem={({ item }) => renderGanhador(item, false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  abas: { flexDirection: 'row', marginBottom: 16, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#1b5e20' },
  aba: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#fff' },
  abaAtiva: { backgroundColor: '#1b5e20' },
  abaTexto: { fontWeight: '600', color: '#1b5e20', fontSize: 14 },
  abaTextoAtivo: { color: '#fff' },
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
  posicaoBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1b5e20', alignItems: 'center', justifyContent: 'center' },
  posicaoTexto: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  ganhadorInfo: { flex: 1 },
  cupomDestaque: { backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 },
  cupomNumero: { color: '#1b5e20', fontWeight: 'bold', fontSize: 15, letterSpacing: 2 },
  ganhadorNome: { fontSize: 14, fontWeight: '700', color: '#333' },
  ganhadorDetalhe: { fontSize: 12, color: '#777', marginTop: 1 },
  btnApagar: { padding: 4, alignSelf: 'flex-start' },
  secaoHeader: { backgroundColor: '#e8f5e9', padding: 12, borderLeftWidth: 4, borderLeftColor: '#1b5e20', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderRadius: 6 },
  secaoHeaderTexto: { fontSize: 14, fontWeight: '700', color: '#1b5e20' },
  secaoHeaderCount: { fontSize: 12, color: '#555' },
  btnApagarTodos: { backgroundColor: '#ffebee', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  btnApagarTodosTexto: { color: '#c62828', fontWeight: '600', fontSize: 13 },
  vazio: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },
});
