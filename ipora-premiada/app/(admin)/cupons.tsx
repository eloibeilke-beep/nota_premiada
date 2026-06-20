import { getItem } from '@/src/storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

const API_URL = 'http://192.168.3.51:8000';

type Nota = {
  id: string;
  nomeUsuario: string;
  cpfUsuario: string;
  razaoSocial: string;
  municipio: string;
  numeroCupom: number;
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
      const res = await fetch(`${API_URL}/admin/cupons?cpfAdmin=${cpf}`);
      const json = await res.json();
      setNotas(json);
      setFiltradas(json);
    } catch (e) {
      console.log(e);
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
      String(n.numeroCupom).includes(termo)
    ));
  }, [busca, notas]);

  const totalCupons = notas.reduce((acc, n) => acc + (n.cupons ?? 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.topo}>
        <View>
          <Text style={styles.titulo}>Cupons</Text>
          <Text style={styles.subtitulo}>{totalCupons} cupons válidos de {notas.length} notas</Text>
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
          renderItem={({ item }) => (
            <View style={[styles.card, item.cupons === 0 && styles.cardInativo]}>
              <View style={styles.cardTopo}>
                <Text style={styles.cardNome} numberOfLines={1}>{item.nomeUsuario}</Text>
                {item.cupons > 0 && (
                  <View style={styles.cupomBadge}>
                    <Text style={styles.cupomNumero}>#{String(item.numeroCupom).padStart(6, '0')}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardInfo}>🏢 {item.razaoSocial}</Text>
              <Text style={styles.cardInfo}>📍 {item.municipio}</Text>
              <Text style={styles.cardInfo}>📅 {item.mesAno}</Text>
              {item.cupons === 0 && <Text style={styles.semCupom}>⚠️ Sem cupom</Text>}
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
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1, borderLeftWidth: 4, borderLeftColor: '#2e7d32' },
  cardInativo: { borderLeftColor: '#e0e0e0', opacity: 0.6 },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardNome: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  cardInfo: { fontSize: 12, color: '#777', marginTop: 2 },
  cupomBadge: { backgroundColor: '#2e7d32', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  cupomNumero: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  semCupom: { fontSize: 12, color: '#e65100', marginTop: 4 },
});
