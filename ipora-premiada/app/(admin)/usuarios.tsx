import { getItem } from '@/src/storage';
import { apiUrl } from '@/src/api';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Usuario = {
  cpf: string;
  nome: string;
  telefone: string;
  perfil: string;
  verificado: boolean;
  dataCadastro: any;
};

export default function UsuariosScreen() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtrados, setFiltrados] = useState<Usuario[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [ordem, setOrdem] = useState<'az' | 'za'>('az');
  const limparBusca = () => setBusca('');

  const buscarUsuarios = async () => {
    setCarregando(true);
    try {
      const cpf = await getItem('cpf');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const res = await fetch(apiUrl(`/admin/usuarios?cpfAdmin=${cpf}&limit=500`), { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setUsuarios(json);
      setFiltrados(json);
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
      alert(`Erro ao carregar usuários: ${e instanceof Error ? e.message : 'Tente novamente'}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { buscarUsuarios(); }, []);

  useEffect(() => {
    const termo = (busca || '').toLowerCase().trim();
    const termoDigits = termo.replace(/\D/g, '');

    const result = usuarios.filter(u => {
      const nome = (u.nome || '').toLowerCase();
      const telefone = (u.telefone || '').replace(/\D/g, '');
      const cpfLimpo = (u.cpf || '').replace(/\D/g, '');
      return !termo || (termoDigits && cpfLimpo.includes(termoDigits)) || nome.includes(termo) || telefone.includes(termoDigits);
    });
    result.sort((a, b) => ordem === 'az'
      ? (a.nome || '').localeCompare(b.nome || '')
      : (b.nome || '').localeCompare(a.nome || ''));
    setFiltrados(result);
  }, [busca, usuarios, ordem]);

  return (
    <View style={styles.container}>
      <View style={styles.topo}>
        <View>
          <Text style={styles.titulo}>Usuários</Text>
          <Text style={styles.subtitulo}>{usuarios.length} cadastrados</Text>
        </View>
        <View style={styles.ordemRow}>
          {(['az', 'za'] as const).map(o => (
            <TouchableOpacity key={o} style={[styles.ordemBotao, ordem === o && styles.ordemAtivo]} onPress={() => setOrdem(o)}>
              <Text style={[styles.ordemTexto, ordem === o && styles.ordemTextoAtivo]}>{o === 'az' ? 'A→Z' : 'Z→A'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.buscaRow}>
        <TextInput
          style={styles.busca}
          placeholder="Buscar por nome, CPF ou telefone..."
          placeholderTextColor="#999"
          value={busca}
          onChangeText={setBusca}
          returnKeyType="search"
        />
        {busca.length > 0 && (
          <View style={styles.clearButtonWrapper}>
            <Text style={styles.clearButton} onPress={limparBusca}>✕</Text>
          </View>
        )}
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color="#1b5e20" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={item => item.cpf}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={buscarUsuarios} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTopo}>
                <Text style={styles.cardNome}>{item.nome}</Text>
                <View style={[styles.badge, item.perfil === 'admin' ? styles.badgeAdmin : styles.badgeUsuario]}>
                  <Text style={styles.badgeTexto}>{item.perfil === 'admin' ? '⭐ Admin' : 'Usuário'}</Text>
                </View>
              </View>
              <Text style={styles.cardInfo}>CPF: {item.cpf}</Text>
              <Text style={styles.cardInfo}>📱 {item.telefone}</Text>
              <Text style={[styles.verificado, item.verificado ? styles.verificadoSim : styles.verificadoNao]}>
                {item.verificado ? '✅ Verificado' : '⏳ Aguardando verificação'}
              </Text>
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
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#1b5e20', marginBottom: 4 },
  subtitulo: { fontSize: 13, color: '#888' },
  ordemRow: { flexDirection: 'row', gap: 8 },
  ordemBotao: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fff' },
  ordemAtivo: { backgroundColor: '#6a1b9a', borderColor: '#6a1b9a' },
  ordemTexto: { fontSize: 12, fontWeight: '700', color: '#555' },
  ordemTextoAtivo: { color: '#fff' },
  busca: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0', color: '#000' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1, borderLeftWidth: 4, borderLeftColor: '#6a1b9a' },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardNome: { fontSize: 15, fontWeight: '700', flex: 1 },
  cardInfo: { fontSize: 12, color: '#777', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeAdmin: { backgroundColor: '#f3e5f5' },
  badgeUsuario: { backgroundColor: '#e8f5e9' },
  badgeTexto: { fontSize: 11, fontWeight: '700', color: '#333' },
  verificado: { fontSize: 12, marginTop: 6, fontWeight: '600' },
  verificadoSim: { color: '#2e7d32' },
  verificadoNao: { color: '#e65100' },
  buscaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  clearButtonWrapper: { marginLeft: 8, backgroundColor: '#eee', padding: 8, borderRadius: 8 },
  clearButton: { fontSize: 14, color: '#333' },
});
