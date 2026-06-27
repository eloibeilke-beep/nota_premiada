import { getItem } from '@/src/storage';
import { apiUrl } from '@/src/api';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

type Nota = {
  id: string;
  nomeUsuario: string;
  cpfUsuario: string;
  razaoSocial: string;
  municipio: string;
  numeroCupom: number;
  numeroCupom2?: number;
  tipoNota?: string;
  cupons: number;
  mesAno: string;
  registradoEm: any;
};

export default function CuponsAdminScreen() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [filtradas, setFiltradas] = useState<Nota[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  const buscarNotas = async () => {
    setCarregando(true);
    try {
      const cpf = await getItem('cpf');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(apiUrl(`/admin/cupons?cpfAdmin=${cpf}`), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setNotas(json);
      setFiltradas(json);
    } catch (e) {
      console.error('Erro ao carregar cupons:', e);
      alert(`Erro ao carregar cupons: ${e instanceof Error ? e.message : 'Tente novamente'}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { buscarNotas(); }, []);

  useEffect(() => {
    const termo = busca.toLowerCase();
    setFiltradas(notas.filter(n =>
      n.nomeUsuario?.toLowerCase().includes(termo) ||
      n.razaoSocial?.toLowerCase().includes(termo) ||
      String(n.numeroCupom).includes(termo) ||
      (n.numeroCupom2 && String(n.numeroCupom2).includes(termo))
    ));
  }, [busca, notas]);

  // Conta todos os cupons incluindo numeroCupom2
  const totalCupons = notas.reduce((acc, n) => acc + (n.cupons ?? 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.topo}>
        <View>
          <Text style={styles.titulo}>Cupons</Text>
          <Text style={styles.subtitulo}>{totalCupons} cupons válidos de {notas.filter(n => n.cupons > 0).length} notas</Text>
        </View>
      </View>

      <TextInput
        style={styles.busca}
        placeholder="Buscar por usuário, empresa ou número..."
        placeholderTextColor="#999"
        value={busca}
        onChangeText={setBusca}
      />

      {carregando ? (
        <ActivityIndicator size="large" color="#1b5e20" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={buscarNotas} />}
          ListEmptyComponent={<Text style={styles.vazio}>Nenhum cupom encontrado.</Text>}
          renderItem={({ item }) => (
            <View style={[
              styles.card,
              item.cupons === 0 && styles.cardInativo,
              item.tipoNota === 'servico' && item.cupons > 0 && styles.cardServico,
            ]}>
              {/* Tag de tipo */}
              {item.tipoNota === 'servico' && item.cupons > 0 && (
                <View style={styles.tagServico}>
                  <Text style={styles.tagServicoTexto}>🔧 SERVIÇO</Text>
                </View>
              )}

              <View style={styles.cardTopo}>
                <Text style={styles.cardNome} numberOfLines={1}>{item.nomeUsuario}</Text>
                {/* Cupons — mostra os dois se for serviço */}
                {item.cupons > 0 && (
                  <View style={styles.cuponsCol}>
                    <View style={[styles.cupomBadge, item.tipoNota === 'servico' && styles.cupomBadgeServico]}>
                      <Text style={styles.cupomNumero}>#{String(item.numeroCupom).padStart(6, '0')}</Text>
                    </View>
                    {item.numeroCupom2 && (
                      <View style={[styles.cupomBadge, styles.cupomBadge2]}>
                        <Text style={styles.cupomNumero}>#{String(item.numeroCupom2).padStart(6, '0')}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <Text style={styles.cardInfo}>🏢 {item.razaoSocial}</Text>
              <Text style={styles.cardInfo}>📍 {item.municipio}</Text>
              <Text style={styles.cardInfo}>📅 {item.mesAno}</Text>
              {item.cpfUsuario && <Text style={styles.cardInfo}>👤 CPF: {item.cpfUsuario}</Text>}
              {item.cupons === 0 && <Text style={styles.semCupom}>⚠️ Sem cupom — fora do município</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#1b5e20' },
  subtitulo: { fontSize: 13, color: '#888' },
  busca: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0', color: '#000' },
  vazio: { textAlign: 'center', color: '#888', marginTop: 40 },

  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    marginBottom: 8, elevation: 1, borderLeftWidth: 4, borderLeftColor: '#2e7d32',
  },
  cardInativo: { borderLeftColor: '#e0e0e0', opacity: 0.6 },
  cardServico: { borderLeftColor: '#1565c0', backgroundColor: '#f0f7ff' },

  tagServico: {
    backgroundColor: '#1565c0', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6,
  },
  tagServicoTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },

  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardNome: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  cardInfo: { fontSize: 12, color: '#777', marginTop: 2 },
  semCupom: { fontSize: 12, color: '#e65100', marginTop: 4 },

  cuponsCol: { alignItems: 'flex-end', gap: 4 },
  cupomBadge: { backgroundColor: '#2e7d32', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  cupomBadgeServico: { backgroundColor: '#1565c0' },
  cupomBadge2: { backgroundColor: '#0d47a1' },
  cupomNumero: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
