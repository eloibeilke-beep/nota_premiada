import { getItem } from '@/src/storage';
import { apiUrl } from '@/src/api';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

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

  const buscarUsuarios = async () => {
    setCarregando(true);
    try {
      const cpf = await getItem('cpf');
      const res = await fetch(apiUrl(`/admin/usuarios?cpfAdmin=${cpf}`));
      const json = await res.json();
      setUsuarios(json);
      setFiltrados(json);
    } catch (e) {
      console.log(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { buscarUsuarios(); }, []);

  useEffect(() => {
    const termo = busca.toLowerCase();
    setFiltrados(usuarios.filter(u =>
      u.nome.toLowerCase().includes(termo) || u.cpf.includes(termo)
    ));
  }, [busca, usuarios]);

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Usuários</Text>
      <Text style={styles.subtitulo}>{usuarios.length} cadastrados</Text>

      <TextInput
        style={styles.busca}
        placeholder="Buscar por nome ou CPF..."
        placeholderTextColor="#999"
        value={busca}
        onChangeText={setBusca}
      />

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
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#1b5e20', marginBottom: 4 },
  subtitulo: { fontSize: 13, color: '#888', marginBottom: 16 },
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
});
