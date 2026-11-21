import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler, Modal, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Linking
} from 'react-native';
import { WebView } from 'react-native-webview';

// Compatibilidad de tipos entre React Native 0.88 y react-native-webview.
const NativeWebView = WebView as unknown as React.ComponentType<any>;

type Article = { id: string; titulo: string; descripcion?: string; columna: string; area?: string; ruta_publica: string; palabras_clave?: string[]; subseccion?: string; estado?: string; };

type Section = {
  id: string; name: string; subtitle: string; description: string;
  color: string; path: string;
};

const SITE = 'https://ciba1000dias-lab.github.io/ciba2.0/';
const SECTIONS: Section[] = [
  { id: 'C', name: 'CRIANZA', subtitle: 'Vínculos que acompañan', description: 'Competencias parentales, apego, lactancia, desarrollo y primeros pasos.', color: '#397653', path: 'c/' },
  { id: 'I', name: 'INFORMÁTICA', subtitle: 'Conocimiento para navegar', description: 'Información sanitaria digital, herramientas y uso responsable de la tecnología.', color: '#287B9A', path: 'i/' },
  { id: 'B', name: 'BIENESTAR', subtitle: 'Cuidar también se aprende', description: 'Prevención, salud infantil, seguridad, hábitos saludables y señales de alerta.', color: '#8C671F', path: 'b/' },
  { id: 'A', name: 'ACOMPAÑAMIENTO', subtitle: 'Nadie cría en soledad', description: 'Orientación, conversación con especialistas y apoyo a las familias.', color: '#A9443B', path: 'a/' }
];

export default function App() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('TODAS');
  const [menuOpen, setMenuOpen] = useState(false);
  const [reader, setReader] = useState<{ title: string; url: string } | null>(null);
  const [readerCanGoBack, setReaderCanGoBack] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading');
  const webViewRef = useRef<any>(null);

  const closeReader = () => {
    setReader(null);
    setReaderCanGoBack(false);
  };

  useEffect(() => {
    if (!reader) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (readerCanGoBack) webViewRef.current?.goBack();
      else closeReader();
      return true;
    });
    return () => subscription.remove();
  }, [reader, readerCanGoBack]);

  useEffect(() => {
    let active = true;
    fetch(SITE + 'data/catalogo.json')
      .then(response => {
        if (!response.ok) throw new Error('Catálogo no disponible');
        return response.json();
      })
      .then(data => {
        if (!active) return;
        setArticles(Array.isArray(data.paginas) ? data.paginas.filter((item: Article) => item.estado === 'publicado' && item.ruta_publica) : []);
        setCatalogState('ready');
      })
      .catch(() => { if (active) setCatalogState('error'); });
    return () => { active = false; };
  }, []);

  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

  const visibleArticles = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    return articles.filter(article => {
      const sectionMatch = selected === 'TODAS' || article.columna === selected;
      const searchable = normalize([
        article.id, article.titulo, article.descripcion || '', article.area || '',
        article.subseccion || '', ...(article.palabras_clave || [])
      ].join(' '));
      return sectionMatch && searchable.includes(q);
    }).slice(0, 30);
  }, [articles, query, selected]);

  const visibleSections = useMemo(() => {
    return SECTIONS.filter(section => selected === 'TODAS' || section.id === selected);
  }, [selected]);

  const openSection = (section: Section) => setReader({ title: section.name, url: SITE + section.path });
  const openArticle = (article: Article) => setReader({ title: article.titulo, url: SITE + article.ruta_publica });
  const openSite = () => Linking.openURL(SITE);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <Modal visible={!!reader} animationType="slide" onRequestClose={closeReader}>
        <SafeAreaView style={styles.readerSafe}>
          <View style={styles.readerHeader}>
            <TouchableOpacity accessibilityRole="button" onPress={() => {
              if (readerCanGoBack) webViewRef.current?.goBack();
              else closeReader();
            }} style={styles.readerBack}>
              <Text style={styles.readerBackText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.readerHeading}>
              <Text numberOfLines={1} style={styles.readerTitle}>{reader?.title || 'CIBA'}</Text>
              <Text style={styles.readerSubtitle}>CIBA · CRECEMOS ACOMPAÑÁNDONOS</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" onPress={closeReader} style={styles.readerClose}>
              <Text style={styles.readerCloseText}>×</Text>
            </TouchableOpacity>
          </View>
          {reader && <NativeWebView
            ref={webViewRef}
            source={{ uri: reader.url }}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled
            setSupportMultipleWindows={false}
            originWhitelist={['https://*']}
            onNavigationStateChange={(state: { canGoBack: boolean }) => setReaderCanGoBack(state.canGoBack)}
            startInLoadingState
            renderLoading={() => <View style={styles.loading}><Text style={styles.loadingText}>Cargando contenido de CIBA…</Text></View>}
          />}
        </SafeAreaView>
      </Modal>

      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity style={styles.brand} onPress={() => { setSelected('TODAS'); setQuery(''); }}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View>
            <View>
              <Text style={styles.brandName}>CIBA</Text>
              <Text style={styles.brandTag}>CRECEMOS ACOMPAÑÁNDONOS</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir menú" style={styles.menuButton} onPress={() => setMenuOpen(!menuOpen)}>
            <Text style={styles.menuIcon}>{menuOpen ? '×' : '☰'}</Text>
          </TouchableOpacity>
        </View>

        {menuOpen && (
          <View style={styles.menuPanel}>
            {SECTIONS.map(section => (
              <TouchableOpacity key={section.id} style={styles.menuItem} onPress={() => { setSelected(section.id); setMenuOpen(false); }}>
                <Text style={styles.menuItemText}>{section.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.menuItem} onPress={openSite}>
              <Text style={styles.menuItemText}>Visitar CIBA en la web</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.hero}>
          <Text style={styles.kicker}>EDUCACIÓN PARENTAL · PRIMEROS MIL DÍAS</Text>
          <Text style={styles.heroTitle}>Crecer en familia.{'\n'}Aprender acompañados.</Text>
          <Text style={styles.heroCopy}>Información comprensible y confiable para acompañar a niñas, niños y a quienes los cuidan.</Text>
          <View style={styles.heroRule} />
          <Text style={styles.heroFoot}>DESDE LA CONCEPCIÓN HASTA LOS DOS AÑOS</Text>
        </View>

        <View style={styles.searchBlock}>
          <Text style={styles.sectionTitle}>¿Qué necesitas saber hoy?</Text>
          <Text style={styles.muted}>Busca entre las áreas de CIBA.</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Ej. lactancia, sueño, desarrollo..."
            placeholderTextColor="#85877D" style={styles.searchInput} returnKeyType="search"
            accessibilityLabel="Buscar contenidos de CIBA" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {['TODAS', ...SECTIONS.map(section => section.id)].map(id => (
              <TouchableOpacity key={id} onPress={() => setSelected(id)} style={[styles.filter, selected === id && styles.filterActive]}>
                <Text style={[styles.filterText, selected === id && styles.filterTextActive]}>{id === 'TODAS' ? 'Todas' : SECTIONS.find(s => s.id === id)?.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {query.trim().length >= 2 && (
            <View style={styles.searchResults}>
              <Text style={styles.searchResultsTitle}>Resultados de artículos</Text>
              {catalogState === 'loading' && <Text style={styles.searchHint}>Cargando el catálogo editorial…</Text>}
              {catalogState === 'error' && <Text style={styles.searchHint}>No se pudo cargar el catálogo. Puedes seguir explorando las cuatro áreas.</Text>}
              {catalogState === 'ready' && visibleArticles.length === 0 && <Text style={styles.searchHint}>No encontramos artículos con esas palabras. Prueba otra búsqueda.</Text>}
              {visibleArticles.map(article => (
                <TouchableOpacity key={article.id} style={styles.articleResult} onPress={() => openArticle(article)}>
                  <Text style={styles.articleResultArea}>{SECTIONS.find(section => section.id === article.columna)?.name || 'CIBA'} · {article.id}</Text>
                  <Text style={styles.articleResultTitle}>{article.titulo}</Text>
                  {!!article.descripcion && <Text style={styles.articleResultDescription}>{article.descripcion}</Text>}
                  <Text style={styles.articleResultLink}>LEER ARTÍCULO  ›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.contentHeading}>
            <Text style={styles.sectionTitle}>Explora CIBA</Text>
            <Text style={styles.muted}>{visibleSections.length} áreas</Text>
          </View>
          {visibleSections.map(section => (
            <TouchableOpacity key={section.id} activeOpacity={0.88} style={styles.sectionCard} onPress={() => openSection(section)}>
              <View style={[styles.cardAccent, { backgroundColor: section.color }]} />
              <View style={styles.cardBody}>
                <Text style={[styles.cardLetter, { color: section.color }]}>{section.id}</Text>
                <Text style={styles.cardTitle}>{section.name}</Text>
                <Text style={styles.cardSubtitle}>{section.subtitle}</Text>
                <Text style={styles.cardDescription}>{section.description}</Text>
                <Text style={[styles.cardLink, { color: section.color }]}>EXPLORAR CONTENIDOS  ›</Text>
              </View>
            </TouchableOpacity>
          ))}
          {visibleSections.length === 0 && <Text style={styles.empty}>No encontramos coincidencias. Prueba con otras palabras.</Text>}
        </View>

        <View style={styles.nayara}>
          <View style={styles.nayaraOrb}><Text style={styles.nayaraOrbText}>N</Text></View>
          <View style={styles.nayaraCopy}>
            <Text style={styles.nayaraTitle}>Dudas de Nayara</Text>
            <Text style={styles.nayaraText}>Un espacio para acercar preguntas cotidianas a información clara y basada en evidencia.</Text>
            <Text style={styles.nayaraNote}>La orientación general no sustituye la valoración individual.</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.webButton} onPress={openSite}>
          <Text style={styles.webButtonText}>ABRIR LA PLATAFORMA CIBA COMPLETA  ↗</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>CIBA</Text>
          <Text style={styles.footerText}>Crecemos acompañándonos.</Text>
          <Text style={styles.footerSmall}>Una plataforma digital cubana de educación parental en los primeros mil días de las infancias.</Text>
          <Text style={styles.footerSmall}>Versión inicial de la aplicación · 0.1.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0E5' },
  page: { paddingBottom: 30, backgroundColor: '#F5F0E5' },
  readerSafe: { flex: 1, backgroundColor: '#F5F0E5' },
  readerHeader: { minHeight: 58, paddingHorizontal: 12, backgroundColor: '#172B27', flexDirection: 'row', alignItems: 'center' },
  readerBack: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
  readerBackText: { color: '#D9B878', fontSize: 34, lineHeight: 38 },
  readerHeading: { flex: 1, paddingHorizontal: 8 },
  readerTitle: { color: '#FFFDF7', fontSize: 13, fontWeight: '800' },
  readerSubtitle: { color: '#D9B878', fontSize: 7, letterSpacing: 1, marginTop: 3 },
  readerClose: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  readerCloseText: { color: '#FFFDF7', fontSize: 27 },
  webView: { flex: 1, backgroundColor: '#F5F0E5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F0E5' },
  loadingText: { color: '#526E56', fontSize: 13 },
  header: { minHeight: 76, paddingHorizontal: 20, backgroundColor: '#172B27', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#D9B878', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#D9B878', fontFamily: 'Georgia', fontSize: 25 },
  brandName: { color: '#F5F0E5', fontSize: 23, fontWeight: '900', letterSpacing: 4 },
  brandTag: { color: '#D9B878', fontSize: 7, letterSpacing: 1.6, marginTop: 3 },
  menuButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { color: '#F5F0E5', fontSize: 27 },
  menuPanel: { backgroundColor: '#203A33', paddingHorizontal: 22, paddingVertical: 8 },
  menuItem: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#526E56' },
  menuItemText: { color: '#F5F0E5', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  hero: { paddingHorizontal: 24, paddingTop: 43, paddingBottom: 36, backgroundColor: '#172B27' },
  kicker: { color: '#D9B878', fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  heroTitle: { color: '#FFFDF7', fontFamily: 'Georgia', fontSize: 37, lineHeight: 43, marginTop: 20 },
  heroCopy: { color: '#D7DED3', fontSize: 14, lineHeight: 23, marginTop: 16, maxWidth: 360 },
  heroRule: { width: 54, height: 2, backgroundColor: '#C97855', marginTop: 26, marginBottom: 14 },
  heroFoot: { color: '#D9B878', fontSize: 8, fontWeight: '700', letterSpacing: 1.4 },
  searchBlock: { paddingHorizontal: 20, paddingTop: 29, paddingBottom: 23, backgroundColor: '#FFFDF7', borderBottomWidth: 1, borderBottomColor: '#E4DDCF' },
  sectionTitle: { color: '#172B27', fontFamily: 'Georgia', fontSize: 25, fontWeight: '400' },
  muted: { color: '#73776D', fontSize: 12, marginTop: 5 },
  searchInput: { minHeight: 49, borderWidth: 1, borderColor: '#E4DDCF', borderRadius: 9, paddingHorizontal: 14, marginTop: 18, color: '#29332D', backgroundColor: '#FFFFFF', fontSize: 13 },
  filters: { gap: 8, paddingTop: 14, paddingBottom: 2 },
  searchResults: { marginTop: 20, gap: 10 },
  searchResultsTitle: { color: '#172B27', fontFamily: 'Georgia', fontSize: 19, marginBottom: 2 },
  searchHint: { color: '#73776D', fontSize: 12, lineHeight: 18 },
  articleResult: { padding: 14, borderWidth: 1, borderColor: '#E4DDCF', borderRadius: 9, backgroundColor: '#F5F0E5' },
  articleResultArea: { color: '#A9583E', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  articleResultTitle: { color: '#172B27', fontFamily: 'Georgia', fontSize: 17, lineHeight: 22, marginTop: 6 },
  articleResultDescription: { color: '#626A60', fontSize: 11, lineHeight: 17, marginTop: 5 },
  articleResultLink: { color: '#397653', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 10 },
  filter: { borderWidth: 1, borderColor: '#D8D0C1', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 13 },
  filterActive: { backgroundColor: '#172B27', borderColor: '#172B27' },
  filterText: { color: '#526057', fontSize: 10, fontWeight: '700' },
  filterTextActive: { color: '#FFFDF7' },
  content: { paddingHorizontal: 20, paddingTop: 30 },
  contentHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 17 },
  sectionCard: { flexDirection: 'row', backgroundColor: '#FFFDF7', borderWidth: 1, borderColor: '#E4DDCF', borderRadius: 12, overflow: 'hidden', marginBottom: 13 },
  cardAccent: { width: 7 },
  cardBody: { flex: 1, padding: 17 },
  cardLetter: { fontFamily: 'Georgia', fontSize: 27 },
  cardTitle: { color: '#172B27', fontSize: 14, fontWeight: '900', letterSpacing: 1.1, marginTop: 3 },
  cardSubtitle: { color: '#A9583E', fontSize: 12, fontWeight: '700', marginTop: 7 },
  cardDescription: { color: '#626A60', fontSize: 12, lineHeight: 19, marginTop: 7 },
  cardLink: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 14 },
  empty: { color: '#73776D', paddingVertical: 25, fontSize: 13 },
  nayara: { flexDirection: 'row', gap: 15, marginHorizontal: 20, marginTop: 24, padding: 18, borderRadius: 14, backgroundColor: '#E9DDC9', borderWidth: 1, borderColor: '#D8C6A8' },
  nayaraOrb: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#D9B878', alignItems: 'center', justifyContent: 'center' },
  nayaraOrbText: { color: '#493A32', fontFamily: 'Georgia', fontSize: 25 },
  nayaraCopy: { flex: 1 },
  nayaraTitle: { color: '#493A32', fontFamily: 'Georgia', fontSize: 20 },
  nayaraText: { color: '#5B554B', fontSize: 12, lineHeight: 18, marginTop: 6 },
  nayaraNote: { color: '#806E53', fontSize: 10, marginTop: 8, fontStyle: 'italic' },
  webButton: { marginHorizontal: 20, marginTop: 23, paddingVertical: 16, borderRadius: 7, backgroundColor: '#A9583E', alignItems: 'center' },
  webButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  footer: { marginTop: 30, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 14, backgroundColor: '#12231F' },
  footerBrand: { color: '#D9B878', fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  footerText: { color: '#F5F0E5', fontFamily: 'Georgia', fontSize: 17, marginTop: 5 },
  footerSmall: { color: '#AEB9AE', fontSize: 10, lineHeight: 16, marginTop: 9 }
});
