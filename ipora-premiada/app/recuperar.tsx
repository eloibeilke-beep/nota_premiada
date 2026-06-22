import { useRouter } from 'expo-router';
import { apiUrl } from '@/src/api';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function RecuperarScreen() {
  const router = useRouter();
  const [cpf, setCpf] = useState('');
  const [etapa, setEtapa] = useState<'cpf' | 'codigo'>('cpf');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  const formatarCpf = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const solicitarCodigo = async () => {
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      Alert.alert('Atenção', 'Digite um CPF válido.');
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch(apiUrl('/recuperar-senha'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfLimpo }),
      });
      const json = await res.json();
      if (!res.ok) { Alert.alert('Erro', json.detail); return; }
      setEtapa('codigo');
      Alert.alert('SMS enviado!', 'Verifique o código no terminal do servidor.');
    } catch {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setCarregando(false);
    }
  };

  const redefinirSenha = async () => {
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (codigo.length !== 4 || novaSenha.length < 4) {
      Alert.alert('Atenção', 'Preencha o código e a nova senha (mínimo 4 dígitos).');
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch(apiUrl('/redefinir-senha'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfLimpo, token: codigo, novaSenha }),
      });
      const json = await res.json();
      if (!res.ok) { Alert.alert('Erro', json.detail); return; }
      Alert.alert('Senha alterada!', 'Faça login com a nova senha.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.titulo}>Recuperar Senha</Text>

      {etapa === 'cpf' ? (
        <View style={styles.form}>
          <Text style={styles.descricao}>Digite seu CPF para receber um código de verificação.</Text>
          <TextInput
            style={styles.input}
            placeholder="CPF"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={cpf}
            onChangeText={v => setCpf(formatarCpf(v))}
          />
          <TouchableOpacity style={styles.botao} onPress={solicitarCodigo} disabled={carregando}>
            <Text style={styles.botaoTexto}>{carregando ? 'Enviando...' : 'Enviar código SMS'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.descricao}>⚠️ Em testes: veja o código no terminal do uvicorn</Text>
          <TextInput
            style={styles.input}
            placeholder="Código de 4 dígitos"
            placeholderTextColor="#999"
            keyboardType="numeric"
            maxLength={4}
            value={codigo}
            onChangeText={setCodigo}
          />
          <TextInput
            style={styles.input}
            placeholder="Nova senha (mínimo 4 dígitos)"
            placeholderTextColor="#999"
            secureTextEntry
            value={novaSenha}
            onChangeText={setNovaSenha}
          />
          <TouchableOpacity style={styles.botao} onPress={redefinirSenha} disabled={carregando}>
            <Text style={styles.botaoTexto}>{carregando ? 'Salvando...' : 'Redefinir senha'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>Voltar para o login</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, gap: 12 },
  titulo: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  descricao: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 8 },
  form: { gap: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: '#fff', color: '#000' },
  botao: { backgroundColor: '#2e7d32', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#2e7d32', marginTop: 16, fontSize: 15 },
});
