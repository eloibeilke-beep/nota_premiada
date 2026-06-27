import { useRouter } from 'expo-router';
import { apiUrl } from '@/src/api';
import { getItem } from '@/src/storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, RefreshControl,
  ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';

type Empresa = {
  id: string;
  cnpj: string;
  razaosocial: string;
  nomefantasia?: string;
  municipio?: string;
  município?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
  situacao?: string;
  ativa: boolean;
};

const EMPRESA_VAZIA = {
  cnpj: '', razaosocial: '', nomefantasia: '', situacao: 'ATIVA',
  endereco: '', bairro: '', cep: '', municipio: '', ativa: true,
};

export default function EmpresasScreen() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtradas, setFiltradas] = useState<Empresa[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [filtroAtivo, setFiltroAtivo] = useState<'todas' | 'ativas' | 'inativas'>('todas');
  const [ordem, setOrdem] = useState<'az' | 'za'>('az');

  // Modal de formulário
  const [modalVisivel, setModalVisivel] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<Empresa | null>(null);
  const [form, setForm] = useState(EMPRESA_VAZIA);

  const buscarEmpresas = async () => {
    setCarregando(true);
    try {
      const cpf = await getItem('cpf');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(apiUrl(`/admin/empresas?cpfAdmin=${cpf}`), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setEmpresas(json);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível carregar as empresas');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { buscarEmpresas(); }, []);

  useEffect(() => {
    const termo = (busca || '').toLowerCase().trim();
    const termoDigits = termo.replace(/\D/g, '');
    let lista = empresas;
    if (filtroAtivo === 'ativas') lista = lista.filter(e => e.ativa);
    if (filtroAtivo === 'inativas') lista = lista.filter(e => !e.ativa);
    const result = lista.filter(e => {
      if (!termo) return true;
      const nome = (e.razaosocial || '').toLowerCase();
      const fantasia = (e.nomefantasia || '').toLowerCase();
      const cnpjLimpo = (e.cnpj || '').replace(/\D/g, '');
      return (termoDigits && cnpjLimpo.includes(termoDigits)) || nome.includes(termo) || fantasia.includes(termo);
    });
    result.sort((a, b) => ordem === 'az'
      ? (a.razaosocial || '').localeCompare(b.razaosocial || '')
      : (b.razaosocial || '').localeCompare(a.razaosocial || ''));
    setFiltradas(result);
  }, [busca, empresas, filtroAtivo, ordem]);

  const abrirNovaEmpresa = () => {
    setEditando(null);
    setForm(EMPRESA_VAZIA);
    setModalVisivel(true);
  };

  const abrirEdicao = (empresa: Empresa) => {
    setEditando(empresa);
    setForm({
      cnpj: empresa.cnpj || '',
      razaosocial: empresa.razaosocial || '',
      nomefantasia: empresa.nomefantasia || '',
      situacao: empresa.situacao || 'ATIVA',
      endereco: empresa.endereco || '',
      bairro: empresa.bairro || '',
      cep: empresa.cep || '',
      municipio: empresa.municipio || empresa.município || '',
      ativa: empresa.ativa ?? true,
    });
    setModalVisivel(true);
  };

  const salvar = async () => {
    if (!form.cnpj.trim() || !form.razaosocial.trim()) {
      Alert.alert('Atenção', 'CNPJ e Razão Social são obrigatórios');
      return;
    }
    setSalvando(true);
    try {
      const cpf = await getItem('cpf');
      const cnpjLimpo = form.cnpj.replace(/\D/g, '');

      let res;
      if (editando) {
        res = await fetch(apiUrl(`/admin/empresa/${cnpjLimpo}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpfAdmin: cpf, ...form }),
        });
      } else {
        res = await fetch(apiUrl('/admin/empresa'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpfAdmin: cpf, ...form }),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        Alert.alert('Erro', json.detail ?? 'Falha ao salvar empresa');
        return;
      }

      Alert.alert('Sucesso', editando ? 'Empresa atualizada!' : 'Empresa cadastrada!');
      setModalVisivel(false);
      buscarEmpresas();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = (empresa: Empresa) => {
    Alert.alert(
      'Excluir empresa',
      `Deseja remover "${empresa.razaosocial}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive', onPress: async () => {
            try {
              const cpf = await getItem('cpf');
              const cnpjLimpo = empresa.cnpj.replace(/\D/g, '');
              const res = await fetch(apiUrl(`/admin/empresa/${cnpjLimpo}?cpfAdmin=${cpf}`), { method: 'DELETE' });
              const json = await res.json();
              if (!res.ok) { Alert.alert('Erro', json.detail ?? 'Falha ao excluir'); return; }
              buscarEmpresas();
            } catch {
              Alert.alert('Erro', 'Não foi possível conectar ao servidor');
            }
          },
        },
      ]
    );
  };

  const formatarCnpj = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 14);
    return n
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  return (
    <View style={styles.container}>
      {/* Topo */}
      <View style={styles.topo}>
        <View>
          <Text style={styles.titulo}>Empresas</Text>
          <Text style={styles.subtitulo}>{empresas.length} cadastradas</Text>
        </View>
        <View style={styles.topoAcoes}>
          <TouchableOpacity style={styles.botaoAdicionar} onPress={abrirNovaEmpresa}>
            <Text style={styles.botaoAdicionarTexto}>+ Nova</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botaoImportar} onPress={() => router.push('/admin' as any)}>
            <Text style={styles.botaoImportarTexto}>📂 CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filtros}>
        {(['todas', 'ativas', 'inativas'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroBotao, filtroAtivo === f && styles.filtroAtivo]}
            onPress={() => setFiltroAtivo(f)}>
            <Text style={[styles.filtroTexto, filtroAtivo === f && styles.filtroTextoAtivo]}>
              {f === 'todas' ? `Todas (${empresas.length})`
                : f === 'ativas' ? `🟢 Ativas (${empresas.filter(e => e.ativa).length})`
                : `🔴 Inativas (${empresas.filter(e => !e.ativa).length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ordem */}
      <View style={styles.ordemRow}>
        <Text style={styles.ordemLabel}>Ordenar:</Text>
        {(['az', 'za'] as const).map(o => (
          <TouchableOpacity key={o} style={[styles.ordemBotao, ordem === o && styles.ordemAtivo]} onPress={() => setOrdem(o)}>
            <Text style={[styles.ordemTexto, ordem === o && styles.ordemTextoAtivo]}>{o === 'az' ? 'A→Z' : 'Z→A'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Busca */}
      <View style={styles.buscaRow}>
        <TextInput
          style={styles.busca}
          placeholder="Buscar por nome, fantasia ou CNPJ..."
          placeholderTextColor="#999"
          value={busca}
          onChangeText={setBusca}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')} style={styles.clearButton}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      {carregando ? (
        <ActivityIndicator size="large" color="#1b5e20" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={item => item.cnpj}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={buscarEmpresas} />}
          ListEmptyComponent={<Text style={styles.vazio}>Nenhuma empresa encontrada.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.ativa && styles.cardInativo]}>
              <View style={styles.cardTopo}>
                <Text style={styles.cardNome} numberOfLines={1}>{item.razaosocial}</Text>
                <View style={[styles.badge, item.ativa ? styles.badgeAtivo : styles.badgeInativo]}>
                  <Text style={[styles.badgeTexto, !item.ativa && styles.badgeTextoInativo]}>
                    {item.ativa ? 'Ativa' : 'Inativa'}
                  </Text>
                </View>
              </View>
              {item.nomefantasia && item.nomefantasia !== '0' &&
                <Text style={styles.cardFantasia}>{item.nomefantasia}</Text>}
              <Text style={styles.cardInfo}>CNPJ: {item.cnpj}</Text>
              <Text style={styles.cardInfo}>📍 {item['município'] || item.municipio}</Text>

              {/* Ações */}
              <View style={styles.cardAcoes}>
                <TouchableOpacity style={styles.btnEditar} onPress={() => abrirEdicao(item)}>
                  <Text style={styles.btnEditarTexto}>✏️ Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnExcluir} onPress={() => confirmarExclusao(item)}>
                  <Text style={styles.btnExcluirTexto}>🗑️ Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal de formulário */}
      <Modal visible={modalVisivel} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>
                {editando ? '✏️ Editar Empresa' : '➕ Nova Empresa'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisivel(false)}>
                <Text style={styles.modalFechar}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>CNPJ *</Text>
              <TextInput
                style={[styles.input, editando && styles.inputDesabilitado]}
                placeholder="00.000.000/0000-00"
                placeholderTextColor="#999"
                value={form.cnpj}
                onChangeText={v => setForm(f => ({ ...f, cnpj: formatarCnpj(v) }))}
                keyboardType="numeric"
                editable={!editando}
              />

              <Text style={styles.label}>Razão Social *</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome da empresa"
                placeholderTextColor="#999"
                value={form.razaosocial}
                onChangeText={v => setForm(f => ({ ...f, razaosocial: v }))}
                autoCapitalize="characters"
              />

              <Text style={styles.label}>Nome Fantasia</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome fantasia (opcional)"
                placeholderTextColor="#999"
                value={form.nomefantasia}
                onChangeText={v => setForm(f => ({ ...f, nomefantasia: v }))}
              />

              <Text style={styles.label}>Município</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Iporã do Oeste - SC"
                placeholderTextColor="#999"
                value={form.municipio}
                onChangeText={v => setForm(f => ({ ...f, municipio: v }))}
              />

              <Text style={styles.label}>Endereço</Text>
              <TextInput
                style={styles.input}
                placeholder="Rua, número"
                placeholderTextColor="#999"
                value={form.endereco}
                onChangeText={v => setForm(f => ({ ...f, endereco: v }))}
              />

              <Text style={styles.label}>Bairro</Text>
              <TextInput
                style={styles.input}
                placeholder="Bairro"
                placeholderTextColor="#999"
                value={form.bairro}
                onChangeText={v => setForm(f => ({ ...f, bairro: v }))}
              />

              <Text style={styles.label}>CEP</Text>
              <TextInput
                style={styles.input}
                placeholder="00000-000"
                placeholderTextColor="#999"
                value={form.cep}
                onChangeText={v => setForm(f => ({ ...f, cep: v }))}
                keyboardType="numeric"
              />

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.label}>Empresa ativa?</Text>
                  <Text style={styles.labelSub}>Apenas empresas ativas geram cupons</Text>
                </View>
                <Switch
                  value={form.ativa}
                  onValueChange={v => setForm(f => ({ ...f, ativa: v }))}
                  trackColor={{ false: '#e0e0e0', true: '#a5d6a7' }}
                  thumbColor={form.ativa ? '#1b5e20' : '#bbb'}
                />
              </View>

              <TouchableOpacity
                style={[styles.btnSalvar, salvando && styles.btnSalvarDesabilitado]}
                onPress={salvar}
                disabled={salvando}>
                {salvando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnSalvarTexto}>
                      {editando ? '💾 Salvar alterações' : '✅ Cadastrar empresa'}
                    </Text>}
              </TouchableOpacity>

              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#1b5e20' },
  subtitulo: { fontSize: 13, color: '#888' },
  topoAcoes: { flexDirection: 'row', gap: 8 },
  botaoAdicionar: { backgroundColor: '#1b5e20', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  botaoAdicionarTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  botaoImportar: { backgroundColor: '#e8f5e9', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#1b5e20' },
  botaoImportarTexto: { color: '#1b5e20', fontWeight: '600', fontSize: 13 },

  filtros: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filtroBotao: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center', backgroundColor: '#fff' },
  filtroAtivo: { backgroundColor: '#1b5e20', borderColor: '#1b5e20' },
  filtroTexto: { fontSize: 11, fontWeight: '600', color: '#555' },
  filtroTextoAtivo: { color: '#fff' },

  ordemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  ordemLabel: { fontSize: 13, color: '#555', fontWeight: '600' },
  ordemBotao: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fff' },
  ordemAtivo: { backgroundColor: '#1b5e20', borderColor: '#1b5e20' },
  ordemTexto: { fontSize: 12, fontWeight: '700', color: '#555' },
  ordemTextoAtivo: { color: '#fff' },

  buscaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  busca: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e0e0e0', color: '#000' },
  clearButton: { marginLeft: 8, backgroundColor: '#eee', padding: 8, borderRadius: 8 },
  clearText: { fontSize: 14, color: '#333' },

  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1, borderLeftWidth: 4, borderLeftColor: '#2e7d32' },
  cardInativo: { borderLeftColor: '#e0e0e0', opacity: 0.65 },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardNome: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  cardFantasia: { fontSize: 12, color: '#555', fontStyle: 'italic', marginBottom: 2 },
  cardInfo: { fontSize: 12, color: '#777', marginTop: 2 },
  cardAcoes: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnEditar: { flex: 1, backgroundColor: '#e8f5e9', padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#a5d6a7' },
  btnEditarTexto: { fontSize: 12, fontWeight: '600', color: '#1b5e20' },
  btnExcluir: { flex: 1, backgroundColor: '#ffebee', padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ffcdd2' },
  btnExcluirTexto: { fontSize: 12, fontWeight: '600', color: '#c62828' },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeAtivo: { backgroundColor: '#e8f5e9' },
  badgeInativo: { backgroundColor: '#ffebee' },
  badgeTexto: { fontSize: 11, fontWeight: '700', color: '#1b5e20' },
  badgeTextoInativo: { color: '#c62828' },

  vazio: { textAlign: 'center', color: '#888', marginTop: 40 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: '#1b5e20' },
  modalFechar: { fontSize: 20, color: '#888', padding: 4 },
  modalScroll: { padding: 20 },

  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 12 },
  labelSub: { fontSize: 11, color: '#888', marginTop: 2 },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 14, color: '#000' },
  inputDesabilitado: { backgroundColor: '#f0f0f0', color: '#999' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, backgroundColor: '#f9f9f9', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0' },

  btnSalvar: { backgroundColor: '#1b5e20', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnSalvarDesabilitado: { opacity: 0.6 },
  btnSalvarTexto: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
