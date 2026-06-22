import { CameraView, useCameraPermissions } from 'expo-camera';
import { getItem } from '@/src/storage';
import { apiUrl } from '@/src/api';
import { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [escaneado, setEscaneado] = useState(false);
  const [cpf, setCpf] = useState('');

  useEffect(() => {
    getItem('cpf').then(c => setCpf(c ?? ''));
  }, []);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>Permissão de câmera necessária</Text>
        <Button title="Permitir" onPress={requestPermission} />
      </View>
    );
  }

  const lerQRCode = async ({ data }: { data: string }) => {
    setEscaneado(true);

    try {
      const resposta = await fetch(apiUrl('/validar-nota'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: data, cpfUsuario: cpf }),
      });

      const json = await resposta.json();

      if (resposta.status === 409) {
        Alert.alert('Nota duplicada', 'Essa nota já foi registrada.', [
          { text: 'OK', onPress: () => setEscaneado(false) },
        ]);
        return;
      }

      if (resposta.status === 403) {
        Alert.alert('Fora do município', json.detail, [
          { text: 'OK', onPress: () => setEscaneado(false) },
        ]);
        return;
      }

      if (!resposta.ok) {
        Alert.alert('Erro', json.detail ?? 'Erro desconhecido.', [
          { text: 'OK', onPress: () => setEscaneado(false) },
        ]);
        return;
      }

      Alert.alert('Nota registrada!', `Empresa: ${json.razao_social}\nMunicípio: ${json.municipio}\nCupom: #${String(json.numeroCupom).padStart(6, '0')}`, [
        { text: 'OK', onPress: () => setEscaneado(false) },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.', [
        { text: 'OK', onPress: () => setEscaneado(false) },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={escaneado ? undefined : lerQRCode}
      />
      {escaneado && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTexto}>Processando...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000066',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTexto: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
