import { useRouter } from 'expo-router';
import { apiUrl } from '@/src/api';
import { getItem } from '@/src/storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Empresa = {
  id: string;
  cnpj: string;
  razaosocial: string;
  nomefantasia?: string;
  município?: string;
  municipio?: string;
  ativa: boolean;
};

export default function EmpresasScreen() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtradas, setFiltradas] = useState<Empresa[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  const buscarEmpresas = async () => {
    setCarregando(true);
    try {
      const cpf = await getItem('cpf');
      const res = await fetch(apiUrl(`/admin/empresas?cpfAdmin=${cpf}`));
      const json = await res.json();
      setEmpresas(json);
      setFiltradas(json);
    } catch (e) {
      console.log(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { buscarEmpresas(); }, []);

  useEffect(() => {
    const termo = busca.toLowerCase();
    setFiltradas(empresas.filter(e =>
      e.razaosocial.toLowerCase().includes(termo) ||
      e.cnpj.includes(termo)
    ));
  }, [busca, empresas]);

  return (
    <View style={styles.container}>
      <View style={styles.topo}>
        <View>
          <Text style={styles.titulo}>Empresas</Text>
          <Text style={styles.subtitulo}>{empresas.length} cadastradas</Text>
        </View>
        <TouchableOpacity style={styles.botaoImportar} onPress={() => router.push('/admin' as any)}>
          <Text style={styles.botaoImportarTexto}>📂 Importar CSV</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.busca}
        placeholder="Buscar por nome ou CNPJ..."
        placeholderTextColor="#999"
        value={busca}
        onChangeText={setBusca}
      />

      {carregando ? (
        <ActivityIndicator size="large" color="#1b5e20" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={item => item.cnpj}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={buscarEmpresas} />}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.ativa && styles.cardInativo]}>
              <View style={styles.cardTopo}>
                <Text style={styles.cardNome} numberOfLines={1}>{item.razaosocial}</Text>
                <View style={[styles.badge, item.ativa ? styles.badgeAtivo : styles.badgeInativo]}>
                  <Text style={styles.badgeTexto}>{item.ativa ? 'Ativa' : 'Inativa'}</Text>
                </View>
              </View>
              {item.nomefantasia && item.nomefantasia !== '0' &&
                <Text style={styles.cardFantasia}>{item.nomefantasia}</Text>}
              <Text style={styles.cardInfo}>CNPJ: {item.cnpj}</Text>
              <Text style={styles.cardInfo}>📍 {item['município'] || item.municipio}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#1b5e20' },
  subtitulo: { fontSize: 13, color: '#888' },
  botaoImportar: { backgroundColor: '#1b5e20', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  botaoImportarTexto: { color: '#fff', fontWeight: '600', fontSize: 13 },
  busca: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0', color: '#000' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1, borderLeftWidth: 4, borderLeftColor: '#2e7d32' },
  cardInativo: { borderLeftColor: '#e0e0e0', opacity: 0.6 },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardNome: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  cardFantasia: { fontSize: 12, color: '#555', fontStyle: 'italic', marginBottom: 2 },
  cardInfo: { fontSize: 12, color: '#777', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeAtivo: { backgroundColor: '#e8f5e9' },
  badgeInativo: { backgroundColor: '#ffebee' },
  badgeTexto: { fontSize: 11, fontWeight: '700', color: '#1b5e20' },
});
