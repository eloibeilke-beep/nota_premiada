import { getItem } from '@/src/storage';
import { apiUrl } from '@/src/api';
import { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

export default function ConfiguracaoScreen() {
  const [quantidadeSorteios, setQuantidadeSorteios] = useState(10);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const opcoes = Array.from({ length: 20 }, (_, i) => i + 1);

  const carregarConfiguracoes = async () => {
    setCarregando(true);
    try {
      const cpf = await getItem('cpf');
      const res = await fetch(apiUrl(`/admin/configuracao-sorteios?cpfAdmin=${cpf}`));
      if (!res.ok) {
        const json = await res.json();
        Alert.alert('Erro', json.detail ?? 'Não foi possível carregar as configurações');
        return;
      }
      const json = await res.json();
      setQuantidadeSorteios(json.quantidadeSorteios ?? 10);
    } catch (e) {
      console.error('Erro ao carregar configurações:', e);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor');
    } finally {
      setCarregando(false);
    }
  };

  const salvarConfiguracao = async (quantidade: number) => {
    setSalvando(true);
    try {
      const cpf = await getItem('cpf');
      const res = await fetch(apiUrl('/admin/salvar-configuracao-sorteios'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpfAdmin: cpf, quantidadeSorteios: quantidade }),
      });

      const json = await res.json();
      if (!res.ok) {
        Alert.alert('Erro', json.detail ?? 'Falha ao salvar configuração');
        return;
      }

      setQuantidadeSorteios(quantidade);
      Alert.alert('Sucesso', `Quantidade de sorteios alterada para ${quantidade}`);
    } catch (e) {
      console.error('Erro ao salvar configuração:', e);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor');
    } finally {
      setSalvando(false);
    }
  };

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1b5e20" />
        <Text style={styles.carregandoTexto}>Carregando configurações...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.titulo}>⚙️ Configurações</Text>
        <Text style={styles.subtitulo}>Gerenciar sorteios</Text>
      </View>

      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>🎲 Quantidade de Sorteios</Text>
        <Text style={styles.descricao}>
          Defina quantos sorteios podem ser realizados por mês e por ano (de 1 a 20).
        </Text>

        <View style={styles.infoAtual}>
          <Text style={styles.infoTexto}>Configuração atual:</Text>
          <Text style={styles.infoValor}>{quantidadeSorteios} sorteios</Text>
        </View>

        <Text style={styles.opcoesTitulo}>Escolha uma opção:</Text>
        <View style={styles.grid}>
          {opcoes.map(opcao => {
            const ativa = quantidadeSorteios === opcao;
            return (
              <TouchableOpacity
                key={opcao}
                style={[styles.opcaoCard, ativa && styles.opcaoCardAtiva]}
                onPress={() => salvarConfiguracao(opcao)}
                disabled={salvando || ativa}>
                <Text style={[styles.opcaoTexto, ativa && styles.opcaoTextoAtivo]}>
                  {opcao}
                </Text>
                <Text style={[styles.opcaoLabel, ativa && styles.opcaoLabelAtivo]}>
                  sorteios
                </Text>
                {ativa && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.avisoBox}>
          <Text style={styles.avisoTitulo}>ℹ️ Informações importantes</Text>
          <Text style={styles.avisoTexto}>
            {'• A quantidade deve estar entre 1 e 20 sorteios\n'}
            {'• Esta configuração afeta todos os sorteios futuros\n'}
            {'• Os sorteios já realizados não serão alterados\n'}
            {'• Recomenda-se não mudar frequentemente'}
          </Text>
        </View>

        <TouchableOpacity style={styles.btnRecarregar} onPress={carregarConfiguracoes}>
          <Text style={styles.btnRecarregarTexto}>🔄 Recarregar</Text>
        </TouchableOpacity>
      </View>

      {salvando && (
        <View style={styles.salvandoOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.salvandoTexto}>Salvando...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  carregandoTexto: { color: '#666', fontSize: 14 },

  header: { padding: 20, paddingTop: 30 },
  titulo: { fontSize: 28, fontWeight: 'bold', color: '#1b5e20', marginBottom: 4 },
  subtitulo: { fontSize: 14, color: '#888' },

  secao: { padding: 20, paddingTop: 10 },
  secaoTitulo: { fontSize: 18, fontWeight: '700', color: '#1b5e20', marginBottom: 8 },
  descricao: { fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 20 },

  infoAtual: {
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2e7d32',
  },
  infoTexto: { fontSize: 12, color: '#666', marginBottom: 4 },
  infoValor: { fontSize: 24, fontWeight: '700', color: '#1b5e20' },

  opcoesTitulo: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  opcaoCard: {
    width: '22%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  opcaoCardAtiva: {
    backgroundColor: '#e8f5e9',
    borderColor: '#2e7d32',
  },
  opcaoTexto: { fontSize: 20, fontWeight: '700', color: '#333' },
  opcaoTextoAtivo: { color: '#1b5e20' },
  opcaoLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  opcaoLabelAtivo: { color: '#2e7d32' },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 8,
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: 'bold',
  },

  avisoBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    marginBottom: 16,
  },
  avisoTitulo: { fontSize: 13, fontWeight: '700', color: '#856404', marginBottom: 8 },
  avisoTexto: { fontSize: 12, color: '#856404', lineHeight: 18 },

  btnRecarregar: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  btnRecarregarTexto: { fontSize: 14, color: '#555', fontWeight: '600' },

  salvandoOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  salvandoTexto: { color: '#fff', marginTop: 12, fontWeight: '600' },
});
