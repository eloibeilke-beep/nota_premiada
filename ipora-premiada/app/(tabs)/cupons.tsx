import { getItem } from '@/src/storage';
import { apiUrl } from '@/src/api';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type Nota = {
  id: string;
  razaoSocial: string;
  municipio: string;
  cupons: number;
  numeroCupom: number;
  mes: number;
  ano: number;
  mesAno: string;
  registradoEm: string;
};

type Secao = {
  titulo: string;
  totalCupons: number;
  data: Nota[];
};

export default function CuponsScreen() {
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [totalAnual, setTotalAnual] = useState(0);
  const [cupomsAnuais, setCupomsAnuais] = useState<number[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);
  const [verAnual, setVerAnual] = useState(false);

  const buscar = async () => {
    setCarregando(true);
    try {
      const cpf = await getItem('cpf');
      const res = await fetch(apiUrl(`/minhas-notas/${cpf}`));
      const notas: Nota[] = await res.json();

      // Agrupa por mês/ano
      const grupos: Record<string, Nota[]> = {};
      notas.forEach(n => {
        let chave = n.mesAno;
        if (!chave) {
          // Fallback: extrai do campo registradoEm (pode ser string ou timestamp Firestore)
          let data: Date;
          if (n.registradoEm && typeof n.registradoEm === 'object' && '_seconds' in (n.registradoEm as any)) {
            data = new Date((n.registradoEm as any)._seconds * 1000);
          } else if (n.registradoEm) {
            data = new Date(n.registradoEm);
          } else {
            data = new Date();
          }
          const m = data.getMonth() + 1;
          const a = data.getFullYear();
          chave = `${String(m).padStart(2,'0')}/${a}`;
        }
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push(n);
      });

      // Ordena meses do mais recente para o mais antigo
      const secoesOrdenadas = Object.entries(grupos)
        .sort(([a], [b]) => {
          const [ma, aa] = a.split('/').map(Number);
          const [mb, ab] = b.split('/').map(Number);
          return ab !== aa ? ab - aa : mb - ma;
        })
        .map(([chave, notas]) => {
          const [m] = chave.split('/').map(Number);
          return {
            titulo: `${MESES[m - 1]} — ${chave.split('/')[1]}`,
            totalCupons: notas.reduce((acc, n) => acc + (n.cupons ?? 0), 0),
            data: notas,
          };
        });

      setSecoes(secoesOrdenadas);
      setTotalAnual(notas.reduce((acc, n) => acc + (n.cupons ?? 0), 0));
      setCupomsAnuais(notas.filter(n => n.cupons > 0).map(n => n.numeroCupom));
    } catch (e) {
      console.log(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { buscar(); }, []);

  if (carregando) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#2e7d32" />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header com total anual */}
      <View style={styles.header}>
        <Text style={styles.titulo}>Meus Cupons</Text>
        <TouchableOpacity style={styles.badgeAnual} onPress={() => setVerAnual(!verAnual)}>
          <Text style={styles.badgeAnualTexto}>🏆 {totalAnual} cupom{totalAnual !== 1 ? 's' : ''} no ano {verAnual ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      </View>

      {/* Painel sorteio anual */}
      {verAnual && (
        <View style={styles.painelAnual}>
          <Text style={styles.painelTitulo}>🎯 Sorteio Anual — todos os seus cupons</Text>
          <View style={styles.cuponsGrid}>
            {cupomsAnuais.map((num, i) => (
              <View key={i} style={styles.cupomAnual}>
                <Text style={styles.cupomAnualTexto}>#{String(num).padStart(6, '0')}</Text>
              </View>
            ))}
          </View>
          {cupomsAnuais.length === 0 && (
            <Text style={styles.semCupomAnual}>Nenhum cupom ainda.</Text>
          )}
        </View>
      )}

      {secoes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.vazio}>Nenhuma nota cadastrada ainda.{'\n'}Escaneie uma nota fiscal! 📷</Text>
        </View>
      ) : (
        <SectionList
          sections={secoes}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={buscar} />}
          renderSectionHeader={({ section }) => (
            <TouchableOpacity
              style={styles.secaoHeader}
              onPress={() => setMesSelecionado(mesSelecionado === section.titulo ? null : section.titulo)}
            >
              <Text style={styles.secaoTitulo}>{section.titulo}</Text>
              <View style={styles.secaoBadge}>
                <Text style={styles.secaoBadgeTexto}>{section.totalCupons} cupom{section.totalCupons !== 1 ? 's' : ''}</Text>
              </View>
            </TouchableOpacity>
          )}
          renderItem={({ item, section }) =>
            mesSelecionado === null || mesSelecionado === section.titulo ? (
              <View style={[styles.card, item.cupons === 0 && styles.cardInativo]}>
                <View style={styles.cardTopo}>
                  <Text style={styles.empresa} numberOfLines={1}>{item.razaoSocial}</Text>
                  {item.cupons > 0 && (
                    <View style={styles.cupomBadge}>
                      <Text style={styles.cupomNumero}>#{String(item.numeroCupom).padStart(6, '0')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.municipio}>📍 {item.municipio}</Text>
                <Text style={styles.data}>🗓 {item.registradoEm ? new Date(
                  typeof item.registradoEm === 'object' && '_seconds' in (item.registradoEm as any)
                    ? (item.registradoEm as any)._seconds * 1000
                    : item.registradoEm
                ).toLocaleString('pt-BR') : ''}</Text>
                {item.cupons === 0 && (
                  <Text style={styles.semCupom}>⚠️ Fora de Iporã do Oeste — sem cupom</Text>
                )}
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#2e7d32', paddingTop: 60, paddingBottom: 20,
    paddingHorizontal: 24, gap: 8,
  },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  badgeAnual: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  badgeAnualTexto: { color: '#2e7d32', fontWeight: 'bold', fontSize: 14 },
  painelAnual: { backgroundColor: '#e8f5e9', padding: 16, borderBottomWidth: 1, borderBottomColor: '#c8e6c9' },
  painelTitulo: { fontSize: 14, fontWeight: '700', color: '#1b5e20', marginBottom: 12 },
  cuponsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cupomAnual: { backgroundColor: '#2e7d32', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  cupomAnualTexto: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  semCupomAnual: { color: '#888', fontSize: 13 },
  vazio: { fontSize: 16, color: '#888', textAlign: 'center', lineHeight: 26 },
  secaoHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#e8f5e9', paddingHorizontal: 16, paddingVertical: 12,
    marginTop: 8, borderLeftWidth: 4, borderLeftColor: '#2e7d32',
  },
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: '#1b5e20' },
  secaoBadge: { backgroundColor: '#2e7d32', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  secaoBadgeTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 8,
    borderRadius: 12, padding: 16, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4,
  },
  cardInativo: { opacity: 0.6, borderLeftWidth: 4, borderLeftColor: '#e65100' },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  empresa: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  cupomBadge: { backgroundColor: '#2e7d32', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  cupomNumero: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  municipio: { fontSize: 13, color: '#666', marginBottom: 2 },
  data: { fontSize: 12, color: '#999' },
  semCupom: { fontSize: 12, color: '#e65100', marginTop: 6 },
});
