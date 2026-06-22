import { useLocalSearchParams, useRouter } from 'expo-router';
import { getItem, setItem } from '@/src/storage';
import { apiUrl } from '@/src/api';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function VerificarScreen() {
  const router = useRouter();
  const { cpf, telefone } = useLocalSearchParams<{ cpf: string; telefone: string }>();
  const [codigo, setCodigo] = useState(['', '', '', '']);
  const inputs = useRef<(TextInput | null)[]>([]);
  const [carregando, setCarregando] = useState(false);

  const aoDigitar = (valor: string, index: number) => {
    const novo = [...codigo];
    novo[index] = valor.replace(/\D/g, '').slice(-1);
    setCodigo(novo);
    if (valor && index < 3) inputs.current[index + 1]?.focus();
  };

  const verificar = async () => {
    const token = codigo.join('');
    if (token.length !== 4) {
      Alert.alert('Atenção', 'Digite os 4 dígitos do SMS.');
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch(apiUrl('/verificar-sms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, token }),
      });

      const json = await res.json();

      if (!res.ok) {
        Alert.alert('Erro', json.detail ?? 'Código inválido.');
        return;
      }

      await setItem('cpf', cpf);
      await setItem('nome', json.nome);
      await setItem('perfil', json.perfil ?? 'usuario');
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setCarregando(false);
    }
  };

  const reenviar = async () => {
    try {
      await fetch(apiUrl('/reenviar-sms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf }),
      });
      Alert.alert('SMS reenviado!', `Código enviado para ${telefone}`);
    } catch {
      Alert.alert('Erro', 'Não foi possível reenviar.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Verificação</Text>
      <Text style={styles.subtitulo}>Digite o código de 4 dígitos{`\n`}enviado por SMS para{`\n`}{telefone}</Text>
      <Text style={styles.dica}>⚠️ Em testes: veja o código no terminal do uvicorn</Text>

      <View style={styles.inputs}>
        {codigo.map((d, i) => (
          <TextInput
            key={i}
            ref={r => { inputs.current[i] = r; }}
            style={styles.caixa}
            keyboardType="numeric"
            maxLength={1}
            value={d}
            onChangeText={v => aoDigitar(v, i)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && !codigo[i] && i > 0)
                inputs.current[i - 1]?.focus();
            }}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.botao} onPress={verificar} disabled={carregando}>
        <Text style={styles.botaoTexto}>{carregando ? 'Verificando...' : 'Confirmar'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={reenviar}>
        <Text style={styles.link}>Reenviar SMS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  titulo: { fontSize: 26, fontWeight: 'bold' },
  subtitulo: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22 },
  dica: { fontSize: 13, color: '#e65100', textAlign: 'center', marginTop: -8 },
  inputs: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  caixa: {
    width: 56, height: 64, borderWidth: 2, borderColor: '#2e7d32',
    borderRadius: 10, textAlign: 'center', fontSize: 28, fontWeight: 'bold',
    backgroundColor: '#fff', color: '#000',
  },
  botao: { backgroundColor: '#2e7d32', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 10 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#2e7d32', fontSize: 15, marginTop: 4 },
});
