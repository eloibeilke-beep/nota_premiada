import { getItem } from '@/src/storage';
import { apiUrl } from '@/src/api';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const res = await fetch(apiUrl(`/admin/stats?cpfAdmin=${cpf}`), { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setStats(json);
    } catch (e: any) {
      console.error('Erro ao carregar stats:', e);
      if (e?.name === 'AbortError') {
        alert('Tempo esgotado. Verifique se o servidor está rodando e tente novamente.');
      } else {
        alert(`Erro ao carregar dashboard: ${e instanceof Error ? e.message : 'Tente novamente'}`);
      }
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
      <View style={styles.topo}>
        <View>
          <Text style={styles.titulo}>Dashboard</Text>
          <Text style={styles.subtitulo}>Visão geral do sistema</Text>
        </View>
        <TouchableOpacity style={styles.botaoAtualizar} onPress={buscar}>
          <Text style={styles.botaoAtualizarTexto}>🔄 Atualizar</Text>
        </TouchableOpacity>
      </View>

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


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingBottom: 40 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#1b5e20', marginBottom: 4 },
  subtitulo: { fontSize: 14, color: '#888' },
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
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  botaoAtualizar: { backgroundColor: '#e8f5e9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botaoAtualizarTexto: { color: '#1b5e20', fontWeight: '600', fontSize: 14 },
});
