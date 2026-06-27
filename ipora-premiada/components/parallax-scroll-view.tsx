import type { PropsWithChildren, ReactElement } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
}>;

export default function ParallaxScrollView({ children, headerImage }: Props) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>{headerImage}</View>
      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 250, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  content: { flex: 1, padding: 32, gap: 16 },
});
