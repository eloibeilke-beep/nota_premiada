import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { apiUrl } from '@/src/api';
import { useEffect, useState } from 'react';
import {
  Alert, FlatList, StyleSheet, Text,
  TouchableOpacity, View, ActivityIndicator
} from 'react-native';
import { getItem } from '@/src/storage';
const SENHA_ADMIN = '1234'; // troque por uma senha segura

type Empresa = {
  cnpj: string;
  razaosocial: string;
  nomefantasia: string;
  situacao: string;
  endereco: string;
  numero: string;
  bairro: string;
  cep: string;
  municipio: string;
  ativa: boolean;
};

type Resultado = {
  cnpj: string;
  razaosocial: string;
  status: 'importado' | 'atualizado' | 'ignorado' | 'erro';
  mensagem?: string;
};

function splitLinha(linha: string, sep: string): string[] {
  if (sep !== ',') return linha.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
  // Para vírgula, respeita campos entre aspas
  const resultado: string[] = [];
  let atual = '';
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') { dentroAspas = !dentroAspas; }
    else if (c === ',' && !dentroAspas) { resultado.push(atual.trim()); atual = ''; }
    else { atual += c; }
  }
  resultado.push(atual.trim());
  return resultado;
}

function parseCsv(texto: string): Empresa[] {
  const linhas = texto.split('\n').filter(l => l.trim());
  if (linhas.length < 2) return [];

  const cabecalho = linhas[0];
  const separador = cabecalho.includes('\t') ? '\t' : cabecalho.includes(';') ? ';' : ',';

  return linhas.slice(1).map(linha => {
    const cols = splitLinha(linha, separador);
    const cnpjRaw = cols[0]?.trim() ?? '';
    const cnpj = cnpjRaw.replace(/\D/g, '').padStart(14, '0');
    return {
      cnpj,
      razaosocial: cols[1]?.trim() ?? '',
      nomefantasia: cols[2]?.trim() ?? '',
      situacao: cols[4]?.trim() ?? '',
      endereco: cols[5]?.trim() ?? '',
      numero: cols[6]?.trim() ?? '',
      bairro: cols[7]?.trim() ?? '',
      cep: cols[8]?.trim() ?? '',
      municipio: cols[9]?.trim() ?? '',
      ativa: cols[4]?.trim().toUpperCase() === 'ATIVA',
    };
  }).filter(e => e.cnpj.length >= 8 && e.razaosocial);
}

export default function AdminScreen() {
  const router = useRouter();
  const [cpfAdmin, setCpfAdmin] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [etapa, setEtapa] = useState<'inicio' | 'preview' | 'resultado'>('inicio');
  const [modoImport, setModoImport] = useState<'inserir' | 'atualizar'>('inserir');

  useEffect(() => {
    getItem('perfil').then(p => {
      if (p !== 'admin') router.replace('/(tabs)');
    });
    getItem('cpf').then(c => setCpfAdmin(c ?? ''));
  }, []);

  const selecionarArquivo = async () => {
    try {
      const doc = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (doc.canceled) return;

      const arquivo = doc.assets[0];
      const res = await fetch(arquivo.uri);
      const texto = await res.text();
      const parsed = parseCsv(texto);
      console.log(`Linhas brutas: ${texto.split('\n').length} | Empresas parseadas: ${parsed.length}`);

      if (parsed.length === 0) {
        Alert.alert('Erro', 'Nenhuma empresa encontrada no arquivo.');
        return;
      }

      setEmpresas(parsed);
      setEtapa('preview');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível ler o arquivo.');
    }
  };

  const importar = async () => {
    Alert.alert(
      'Confirmar importação',
      `Importar ${empresas.length} empresas para o Firebase?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar', onPress: async () => {
            setCarregando(true);
            try {
              const res = await fetch(apiUrl('/admin/importar-empresas'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpfAdmin, empresas, modo: modoImport }),
              });
              const json = await res.json();
              if (!res.ok) { Alert.alert('Erro', json.detail); return; }
              setResultados(json.resultados);
              setEtapa('resultado');
            } catch {
              Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
            } finally {
              setCarregando(false);
            }
          }
        }
      ]
    );
  };

  const importados = resultados.filter(r => r.status === 'importado').length;
  const atualizados = resultados.filter(r => r.status === 'atualizado').length;
  const ignorados = resultados.filter(r => r.status === 'ignorado').length;
  const erros = resultados.filter(r => r.status === 'erro').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Administrador</Text>
        <Text style={styles.subtitulo}>Importação de Empresas</Text>
      </View>

      {etapa === 'inicio' && (
        <View style={styles.centro}>
          <Text style={styles.instrucao}>Selecione o arquivo CSV exportado do cadastro de empresas.</Text>
          <Text style={styles.instrucaoDetalhe}>Separador: TAB | Colunas: cnpj, razaosocial, nomefantasia, tipoestado, situacao, endereco, numero, bairro, cep, municipio</Text>
          <TouchableOpacity style={styles.botao} onPress={selecionarArquivo}>
            <Text style={styles.botaoTexto}>📂 Selecionar arquivo CSV</Text>
          </TouchableOpacity>
        </View>
      )}

      {etapa === 'preview' && (
        <View style={styles.flex}>
          <View style={styles.resumo}>
            <Text style={styles.resumoTexto}>✅ {empresas.length} empresas encontradas</Text>
            <Text style={styles.resumoTexto}>🟢 Ativas: {empresas.filter(e => e.ativa).length}</Text>
            <Text style={styles.resumoTexto}>🔴 Inativas: {empresas.filter(e => !e.ativa).length}</Text>
          </View>

          {/* Modo de importação */}
          <View style={styles.modoContainer}>
            <Text style={styles.modoTitulo}>Modo de importação:</Text>
            <View style={styles.modoOpcoes}>
              <TouchableOpacity
                style={[styles.modoOpcao, modoImport === 'inserir' && styles.modoAtivo]}
                onPress={() => setModoImport('inserir')}>
                <Text style={[styles.modoTexto, modoImport === 'inserir' && styles.modoTextoAtivo]}>
                  ➕ Apenas novas
                </Text>
                <Text style={styles.modoDesc}>Ignora CNPJs já cadastrados</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modoOpcao, modoImport === 'atualizar' && styles.modoAtivo]}
                onPress={() => setModoImport('atualizar')}>
                <Text style={[styles.modoTexto, modoImport === 'atualizar' && styles.modoTextoAtivo]}>
                  🔄 Inserir e atualizar
                </Text>
                <Text style={styles.modoDesc}>Sobrescreve dados existentes</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={empresas}
            keyExtractor={(_, i) => String(i)}
            style={styles.lista}
            renderItem={({ item }) => (
              <View style={[styles.card, !item.ativa && styles.cardInativo]}>
                <Text style={styles.cardNome}>{item.razaosocial}</Text>
                {item.nomefantasia && item.nomefantasia !== '0' &&
                  <Text style={styles.cardFantasia}>{item.nomefantasia}</Text>}
                <Text style={styles.cardInfo}>CNPJ: {item.cnpj}</Text>
                <Text style={styles.cardInfo}>📍 {item.municipio}</Text>
                <Text style={[styles.situacao, item.ativa ? styles.ativa : styles.inativa]}>
                  {item.situacao}
                </Text>
              </View>
            )}
          />

          <View style={styles.rodape}>
            <TouchableOpacity style={styles.botaoSecundario} onPress={() => setEtapa('inicio')}>
              <Text style={styles.botaoSecundarioTexto}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botao} onPress={importar} disabled={carregando}>
              {carregando
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.botaoTexto}>⬆️ Importar para Firebase</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {etapa === 'resultado' && (
        <View style={styles.flex}>
          <View style={styles.resumo}>
            <Text style={styles.resumoTexto}>✅ Importados: {importados}</Text>
            <Text style={styles.resumoTexto}>🔄 Atualizados: {atualizados}</Text>
            {ignorados > 0 && <Text style={styles.resumoTexto}>⏭️ Ignorados: {ignorados}</Text>}
            {erros > 0 && <Text style={styles.resumoTexto}>❌ Erros: {erros}</Text>}
          </View>

          <FlatList
            data={resultados}
            keyExtractor={(_, i) => String(i)}
            style={styles.lista}
            renderItem={({ item }) => (
              <View style={[styles.card, item.status === 'erro' && styles.cardInativo]}>
                <Text style={styles.cardNome}>{item.razaosocial}</Text>
                <Text style={styles.cardInfo}>CNPJ: {item.cnpj}</Text>
                <Text style={[styles.situacao,
                  item.status === 'importado' ? styles.ativa :
                  item.status === 'atualizado' ? styles.atualizado : styles.inativa
                ]}>
                  {item.status === 'importado' ? '✅ Importado' :
                   item.status === 'atualizado' ? '🔄 Atualizado' : `❌ ${item.mensagem}`}
                </Text>
              </View>
            )}
          />

          <TouchableOpacity style={styles.botao} onPress={() => { setEtapa('inicio'); setEmpresas([]); setResultados([]); }}>
            <Text style={styles.botaoTexto}>Nova importação</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  flex: { flex: 1 },
  header: { backgroundColor: '#1b5e20', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitulo: { fontSize: 14, color: '#a5d6a7', marginTop: 2 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  instrucao: { fontSize: 16, textAlign: 'center', color: '#333' },
  instrucaoDetalhe: { fontSize: 12, textAlign: 'center', color: '#888', lineHeight: 18 },
  resumo: { flexDirection: 'row', justifyContent: 'space-around', padding: 16, backgroundColor: '#e8f5e9' },
  resumoTexto: { fontSize: 13, fontWeight: '600', color: '#1b5e20' },
  lista: { flex: 1, paddingHorizontal: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginVertical: 4, elevation: 1 },
  cardInativo: { opacity: 0.5 },
  cardNome: { fontSize: 14, fontWeight: '600' },
  cardFantasia: { fontSize: 12, color: '#555', fontStyle: 'italic' },
  cardInfo: { fontSize: 12, color: '#777', marginTop: 2 },
  situacao: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  ativa: { color: '#2e7d32' },
  atualizado: { color: '#1565c0' },
  inativa: { color: '#c62828' },
  rodape: { flexDirection: 'row', padding: 16, gap: 12 },
  botao: { flex: 1, backgroundColor: '#1b5e20', padding: 16, borderRadius: 10, alignItems: 'center' },
  botaoTexto: { color: '#fff', fontSize: 15, fontWeight: '600' },
  botaoSecundario: { flex: 1, backgroundColor: '#eee', padding: 16, borderRadius: 10, alignItems: 'center' },
  botaoSecundarioTexto: { color: '#333', fontSize: 15, fontWeight: '600' },
  modoContainer: { backgroundColor: '#fff', margin: 12, borderRadius: 10, padding: 12 },
  modoTitulo: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 8 },
  modoOpcoes: { flexDirection: 'row', gap: 8 },
  modoOpcao: { flex: 1, borderWidth: 2, borderColor: '#ddd', borderRadius: 8, padding: 10, alignItems: 'center' },
  modoAtivo: { borderColor: '#1b5e20', backgroundColor: '#e8f5e9' },
  modoTexto: { fontSize: 13, fontWeight: '600', color: '#555' },
  modoTextoAtivo: { color: '#1b5e20' },
  modoDesc: { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 2 },
});
