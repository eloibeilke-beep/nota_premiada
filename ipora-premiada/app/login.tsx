import { useRouter } from 'expo-router';
import { getItem, setItem } from '@/src/storage';
import { apiUrl } from '@/src/api';
import { useState, useRef } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const senhaRef = useRef<TextInput | null>(null);

  const formatarCpf = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const entrar = async () => {
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11 || senha.length < 4) {
      Alert.alert('Atenção', 'CPF ou senha inválidos.');
      return;
    }

    setCarregando(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(apiUrl('/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfLimpo, senha }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const json = await res.json();

      if (!res.ok) {
        Alert.alert('Erro', json.detail ?? 'Credenciais inválidas.');
        return;
      }

      await setItem('cpf', cpfLimpo);
      await setItem('nome', json.nome);
      await setItem('perfil', json.perfil ?? 'usuario');

      if (json.perfil === 'admin') {
        router.replace('/(admin)/dashboard' as any);
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        Alert.alert('Tempo esgotado', 'O servidor demorou para responder. Verifique sua conexão.');
      } else {
        Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        <Text style={styles.titulo}>Iporã Premiada</Text>
        <Text style={styles.subtitulo}>Entrar</Text>

        <TextInput
          style={styles.input}
          placeholder="CPF"
          placeholderTextColor="#999"
          keyboardType="numeric"
          returnKeyType="next"
          blurOnSubmit={false}
          value={cpf}
          onChangeText={v => setCpf(formatarCpf(v))}
          onSubmitEditing={() => senhaRef.current?.focus()}
        />

        <TextInput
          ref={senhaRef}
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#999"
          secureTextEntry
          returnKeyType="done"
          value={senha}
          onChangeText={setSenha}
          onSubmitEditing={entrar}
        />

        <TouchableOpacity style={styles.botao} onPress={entrar} disabled={carregando}>
          <Text style={styles.botaoTexto}>{carregando ? 'Entrando...' : 'Entrar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/cadastro')}>
          <Text style={styles.link}>Não tem conta? Cadastre-se</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/recuperar')}>
          <Text style={styles.link}>Esqueci minha senha</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#121212' },
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 32,
    paddingTop: 80,
    gap: 12,
    paddingBottom: 48,
  },
  titulo: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 4, color: '#fff' },
  subtitulo: { fontSize: 18, textAlign: 'center', marginBottom: 16, color: '#aaa' },
  input: { borderWidth: 1, borderColor: '#444', borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: '#1e1e1e', color: '#fff' },
  botao: { backgroundColor: '#2e7d32', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#4caf50', marginTop: 12, fontSize: 15 },
});
