import { apiUrl } from '@/src/api';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, SectionList,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

type Ganhador = {
  id: string;
  numeroCupom: number;
  nomeUsuario: string;
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

export default function ResultadosScreen() {
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const buscar = async () => {
    setCarregando(true);
    setErro(false);
    try {
      const res = await fetch(apiUrl('/resultados-publicos'));
      if (!res.ok) throw new Error();
      const json: Ganhador[] = await res.json();

      if (json.length === 0) {
        setSecoes([]);
        return;
      }

      // Agrupa por período
      const grupos: Record<string, Ganhador[]> = {};
      json.forEach(g => {
        const chave = g.tipo === 'anual'
          ? `🏆 Sorteio Anual — ${g.ano}`
          : `📅 ${MESES[(g.mes ?? 1) - 1]} ${g.ano}`;
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push(g);
      });

      const secoesOrdenadas = Object.entries(grupos).map(([titulo, data]) => ({
        titulo,
        data: data.sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0)),
      }));

      setSecoes(secoesOrdenadas);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { buscar(); }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>🏆 Ganhadores</Text>
        <Text style={styles.subtitulo}>Resultados publicados pelo município</Text>
      </View>

      {carregando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#f9a825" />
        </View>
      ) : erro ? (
        <View style={styles.center}>
          <Text style={styles.erroTexto}>Não foi possível carregar os resultados.</Text>
          <TouchableOpacity style={styles.btnRecarregar} onPress={buscar}>
            <Text style={styles.btnRecarregarTexto}>🔄 Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : secoes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.trofeu}>🏅</Text>
          <Text style={styles.vazioTitulo}>Nenhum resultado publicado</Text>
          <Text style={styles.vazioSub}>
            Os ganhadores aparecerão aqui quando o município publicar os resultados.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={secoes}
          keyExtractor={item => `${item.id}-${item.posicao}`}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={buscar} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderSectionHeader={({ section }) => (
            <View style={styles.secaoHeader}>
              <Text style={styles.secaoTitulo}>{section.titulo}</Text>
              <Text style={styles.secaoCount}>
                {section.data.length} ganhador{section.data.length !== 1 ? 'es' : ''}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const ehServico = item.tipoNota === 'servico';
            return (
              <View style={[styles.card, ehServico && styles.cardServico]}>
                <View style={[styles.posicaoBadge, ehServico && styles.posicaoBadgeServico]}>
                  <Text style={styles.posicaoTexto}>{item.posicao}º</Text>
                </View>
                <View style={styles.info}>
                  {ehServico && (
                    <View style={styles.tagServico}>
                      <Text style={styles.tagServicoTexto}>🔧 SERVIÇO</Text>
                    </View>
                  )}
                  <View style={[styles.cupomBadge, ehServico && styles.cupomBadgeServico]}>
                    <Text style={[styles.cupomNumero, ehServico && styles.cupomNumeroServico]}>
                      #{String(item.numeroCupom).padStart(6, '0')}
                    </Text>
                  </View>
                  <Text style={styles.nome}>{item.nomeUsuario}</Text>
                  <Text style={styles.detalhe}>🏢 {item.razaoSocial}</Text>
                  <Text style={styles.detalhe}>📅 {item.mesAno}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fffde7' },
  header: {
    backgroundColor: '#f9a825', paddingTop: 60, paddingBottom: 20,
    paddingHorizontal: 24,
  },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitulo: { fontSize: 13, color: '#fff8e1', marginTop: 2 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  erroTexto: { fontSize: 15, color: '#888', textAlign: 'center' },
  btnRecarregar: { backgroundColor: '#f9a825', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  btnRecarregarTexto: { color: '#fff', fontWeight: '600' },

  trofeu: { fontSize: 60 },
  vazioTitulo: { fontSize: 18, fontWeight: '700', color: '#555', textAlign: 'center' },
  vazioSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },

  secaoHeader: {
    backgroundColor: '#fff8e1', padding: 12, borderLeftWidth: 4,
    borderLeftColor: '#f9a825', flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, marginHorizontal: 12, borderRadius: 6,
  },
  secaoTitulo: { fontSize: 14, fontWeight: '700', color: '#e65100' },
  secaoCount: { fontSize: 12, color: '#888' },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginHorizontal: 12, marginTop: 8,
    flexDirection: 'row', gap: 12,
    elevation: 2, borderLeftWidth: 4, borderLeftColor: '#f9a825',
  },
  cardServico: { borderLeftColor: '#1565c0', backgroundColor: '#f0f7ff' },

  posicaoBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f9a825', alignItems: 'center', justifyContent: 'center',
  },
  posicaoBadgeServico: { backgroundColor: '#1565c0' },
  posicaoTexto: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  info: { flex: 1 },
  tagServico: {
    backgroundColor: '#1565c0', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4,
  },
  tagServicoTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },

  cupomBadge: {
    backgroundColor: '#fff8e1', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4,
  },
  cupomBadgeServico: { backgroundColor: '#dbeafe' },
  cupomNumero: { color: '#e65100', fontWeight: 'bold', fontSize: 16, letterSpacing: 2 },
  cupomNumeroServico: { color: '#1565c0' },

  nome: { fontSize: 14, fontWeight: '700', color: '#333' },
  detalhe: { fontSize: 12, color: '#777', marginTop: 2 },
});
