import { useRouter } from 'expo-router';
import { getItem, setItem, deleteItem } from '@/src/storage';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [perfil, setPerfil] = useState('');

  useEffect(() => {
    getItem('cpf').then(cpf => {
      if (!cpf) router.replace('/login');
    });
    getItem('nome').then(n => setNome(n ?? ''));
    getItem('perfil').then(p => setPerfil(p ?? 'usuario'));
  }, []);

  const sair = async () => {
    await deleteItem('cpf');
    await deleteItem('nome');
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Iporã Premiada</Text>
      {nome ? <Text style={styles.bemvindo}>Olá, {nome.split(' ')[0]}! 👋</Text> : null}

      <TouchableOpacity style={styles.botao} onPress={() => router.push('/scanner')}>
        <Text style={styles.botaoTexto}>📷 Ler Nota Fiscal</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.botaoSair} onPress={sair}>
        <Text style={styles.botaoSairTexto}>Sair</Text>
      </TouchableOpacity>

      {perfil === 'admin' && (
        <TouchableOpacity onPress={() => router.push('/(admin)/dashboard' as any)}>
          <Text style={styles.linkAdmin}>⚙️ Painel Administrativo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 32 },
  titulo: { fontSize: 28, fontWeight: 'bold' },
  bemvindo: { fontSize: 16, color: '#555' },
  botao: { backgroundColor: '#2e7d32', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  botaoTexto: { color: '#fff', fontSize: 18, fontWeight: '600' },
  botaoSair: { marginTop: 8 },
  botaoSairTexto: { color: '#c62828', fontSize: 15 },
  linkAdmin: { color: '#888', fontSize: 13, marginTop: 8 },
});
