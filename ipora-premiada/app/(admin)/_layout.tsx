import { getItem, deleteItem } from '@/src/storage';
import { useRouter, usePathname, Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, Dimensions, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MENU = [
  { label: 'Dashboard', icon: '📊', rota: '/(admin)/dashboard' },
  { label: 'Empresas', icon: '🏢', rota: '/(admin)/empresas' },
  { label: 'Usuários', icon: '👥', rota: '/(admin)/usuarios' },
  { label: 'Cupons', icon: '🎟️', rota: '/(admin)/cupons' },
  { label: 'Sorteio', icon: '🏆', rota: '/(admin)/sorteio' },
];

export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [nome, setNome] = useState('');
  const [sidebarAberta, setSidebarAberta] = useState(Platform.OS === 'web');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getItem('perfil').then(p => {
      if (p !== 'admin') router.replace('/(tabs)');
    });
    getItem('nome').then(n => setNome(n ?? ''));
  }, []);

  const sair = async () => {
    await deleteItem('cpf');
    await deleteItem('nome');
    await deleteItem('perfil');
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      {sidebarAberta && (
        <View style={styles.sidebar}>
          <View style={[styles.sidebarHeader, { paddingTop: insets.top + 16 }]}>
            <Text style={styles.logo}>🏅 Iporã</Text>
            <Text style={styles.logoSub}>Premiada</Text>
          </View>

          <ScrollView style={styles.menu}>
            {MENU.map(item => {
              const ativo = pathname.includes(item.rota.replace('/(admin)/', ''));
              return (
                <TouchableOpacity
                  key={item.rota}
                  style={[styles.menuItem, ativo && styles.menuItemAtivo]}
                  onPress={() => {
                    router.push(item.rota as any);
                    if (Platform.OS !== 'web') setSidebarAberta(false);
                  }}>
                  <Text style={styles.menuIcone}>{item.icon}</Text>
                  <Text style={[styles.menuTexto, ativo && styles.menuTextoAtivo]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sidebarFooter}>
            <View style={styles.footerInfo}>
              <Text style={styles.footerNome}>👤 {nome.split(' ')[0]}</Text>
              <TouchableOpacity onPress={sair}>
                <Text style={styles.footerSair}>Sair</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.footerVoltar}>
              <Text style={styles.footerVoltarTexto}>← Voltar ao App</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Conteúdo */}
      <View style={styles.conteudo}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => setSidebarAberta(!sidebarAberta)} style={styles.menuBtn}>
            <Text style={styles.menuBtnTexto}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitulo}>Painel Administrativo</Text>
          <Text style={styles.headerNome}>{nome}</Text>
        </View>

        {/* Página */}
        <View style={styles.pagina}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f0f2f5' },

  // Sidebar
  sidebar: {
    width: 220, backgroundColor: '#1b5e20',
    ...(Platform.OS === 'web' ? {} : { position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 100 }),
  },
  sidebarHeader: { padding: 24, paddingTop: 48, borderBottomWidth: 1, borderBottomColor: '#2e7d32' },
  logo: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  logoSub: { fontSize: 12, color: '#a5d6a7', marginTop: 2 },
  menu: { flex: 1, paddingTop: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 20, marginHorizontal: 8,
    borderRadius: 8, marginBottom: 2,
  },
  menuItemAtivo: { backgroundColor: '#2e7d32' },
  menuIcone: { fontSize: 18 },
  menuTexto: { fontSize: 14, color: '#c8e6c9', fontWeight: '500' },
  menuTextoAtivo: { color: '#fff', fontWeight: '700' },
  sidebarFooter: {
    padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#2e7d32', gap: 8,
  },
  footerInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  footerNome: { color: '#a5d6a7', fontSize: 13 },
  footerSair: { color: '#ef9a9a', fontSize: 13, fontWeight: '600' },
  footerVoltar: { backgroundColor: '#2e7d32', padding: 10, borderRadius: 8, alignItems: 'center' },
  footerVoltarTexto: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Conteúdo
  conteudo: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  menuBtn: { padding: 4 },
  menuBtnTexto: { fontSize: 22, color: '#1b5e20' },
  headerTitulo: { fontSize: 16, fontWeight: '700', color: '#1b5e20' },
  headerNome: { fontSize: 13, color: '#888' },
  pagina: { flex: 1 },
});
