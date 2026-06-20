import { getItem } from '@/src/storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = 'http://192.168.3.51:8000';

type Stats = {
  totalUsuarios: number;
  totalEmpresas: number;
  totalNotas: number;
  totalCupons: number;
  notasMes: number;
  cupomsMes: number;
};

function Card({ icon, label, valor, cor }: { icon: string; label: string; valor: number; cor: string }) {
  return (
    <View style={[styles.card, { borderLeftColor: cor }]}>
      <Text style={styles.cardIcone}>{icon}</Text>
      <Text style={[styles.cardValor, { color: cor }]}>{valor}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mes] = useState(new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' }));

  const buscar = async () => {
    setCarregando(true);
    try {
      const cpf = await getItem('cpf');
      const res = await fetch(`${API_URL}/admin/stats?cpfAdmin=${cpf}`);
      const json = await res.json();
      setStats(json);
    } catch (e) {
      console.log(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { buscar(); }, []);

  if (carregando) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#1b5e20" />
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Dashboard</Text>
      <Text style={styles.subtitulo}>Visão geral do sistema</Text>

      <Text style={styles.secao}>📅 {mes.charAt(0).toUpperCase() + mes.slice(1)}</Text>
      <View style={styles.grid}>
        <Card icon="📋" label="Notas no mês" valor={stats?.notasMes ?? 0} cor="#1565c0" />
        <Card icon="🎟️" label="Cupons no mês" valor={stats?.cupomsMes ?? 0} cor="#2e7d32" />
      </View>

      <Text style={styles.secao}>📊 Total geral</Text>
      <View style={styles.grid}>
        <Card icon="👥" label="Usuários" valor={stats?.totalUsuarios ?? 0} cor="#6a1b9a" />
        <Card icon="🏢" label="Empresas" valor={stats?.totalEmpresas ?? 0} cor="#e65100" />
        <Card icon="📋" label="Notas" valor={stats?.totalNotas ?? 0} cor="#1565c0" />
        <Card icon="🎟️" label="Cupons" valor={stats?.totalCupons ?? 0} cor="#2e7d32" />
      </View>

      <TouchableOpacity style={styles.botaoAtualizar} onPress={buscar}>
        <Text style={styles.botaoAtualizarTexto}>🔄 Atualizar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingBottom: 40 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#1b5e20', marginBottom: 4 },
  subtitulo: { fontSize: 14, color: '#888', marginBottom: 24 },
  secao: { fontSize: 14, fontWeight: '700', color: '#555', marginBottom: 12, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20,
    borderLeftWidth: 4, minWidth: 140, flex: 1,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
  },
  cardIcone: { fontSize: 28, marginBottom: 8 },
  cardValor: { fontSize: 32, fontWeight: 'bold', marginBottom: 4 },
  cardLabel: { fontSize: 13, color: '#888' },
  botaoAtualizar: { alignSelf: 'flex-start', backgroundColor: '#e8f5e9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  botaoAtualizarTexto: { color: '#1b5e20', fontWeight: '600', fontSize: 14 },
});
