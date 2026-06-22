import { useRouter } from 'expo-router';
import { apiUrl } from '@/src/api';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';

export default function CadastroScreen() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  const formatarCpf = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatarTelefone = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    if (n.length <= 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const cadastrar = async () => {
    const cpfLimpo = cpf.replace(/\D/g, '');
    const telLimpo = telefone.replace(/\D/g, '');

    if (!nome || cpfLimpo.length !== 11 || telLimpo.length < 10 || senha.length < 4) {
      Alert.alert('Atenção', 'Preencha todos os campos corretamente.\nSenha mínima: 4 dígitos.');
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch(apiUrl('/cadastrar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cpf: cpfLimpo, telefone: telLimpo, senha }),
      });

      const json = await res.json();

      if (!res.ok) {
        Alert.alert('Erro', json.detail ?? 'Erro ao cadastrar.');
        return;
      }

      // Vai para tela de verificação SMS
      router.push({ pathname: '/verificar', params: { cpf: cpfLimpo, telefone: telLimpo } });
    } catch {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.titulo}>Cadastro</Text>

        <TextInput style={styles.input} placeholder="Nome completo" placeholderTextColor="#999" value={nome} onChangeText={setNome} />

        <TextInput
          style={styles.input}
          placeholder="CPF"
          placeholderTextColor="#999"
          keyboardType="numeric"
          value={cpf}
          onChangeText={v => setCpf(formatarCpf(v))}
        />

        <TextInput
          style={styles.input}
          placeholder="Telefone (WhatsApp)"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
          value={telefone}
          onChangeText={v => setTelefone(formatarTelefone(v))}
        />

        <TextInput
          style={styles.input}
          placeholder="Senha (mínimo 4 dígitos)"
          placeholderTextColor="#999"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
        />

        <TouchableOpacity style={styles.botao} onPress={cadastrar} disabled={carregando}>
          <Text style={styles.botaoTexto}>{carregando ? 'Enviando SMS...' : 'Cadastrar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Já tem conta? Entrar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 32, gap: 12 },
  titulo: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: '#fff', color: '#000' },
  botao: { backgroundColor: '#2e7d32', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#2e7d32', marginTop: 12, fontSize: 15 },
});
