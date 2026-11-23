import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, BackHandler, Image, Modal, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View, Linking, ActivityIndicator
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NativeWebView = WebView as unknown as React.ComponentType<any>;
type Article = {
  id: string; titulo: string; descripcion?: string; columna: string;
  area?: string; ruta_publica: string; palabras_clave?: string[];
  subseccion?: string; estado?: string;
};
type Section = { id: string; name: string; subtitle: string; description: string; color: string; path: string };
type CatalogArea = { id: string; titulo: string; descripcion?: string; columna: string; ruta_publica: string; orden?: number };
type CatalogSubsection = { id: string; titulo: string; descripcion?: string; columna: string; area: string; ruta_publica: string };
type Catalog = { version: number; generado?: string; columnas: any[]; areas: CatalogArea[]; subsecciones: CatalogSubsection[]; paginas: Article[] };
type SavedPage = { id: string; title: string; url: string; html: string; savedAt: number };
type HistoryItem = { id: string; title: string; url: string; viewedAt: number };

const SITE = 'https://ciba1000dias-lab.github.io/ciba2.0/';
const CATALOG_URL = SITE + 'data/catalogo.json';
const KEYS = {
  catalog: '@ciba/catalogo-v2',
  favorites: '@ciba/favoritos-v1',
  history: '@ciba/historial-v1',
  downloads: '@ciba/descargas-v1'
};
const APP_VERSION = '0.3.0';
const SECTIONS: Section[] = [
  { id: 'C', name: 'CRIANZA', subtitle: 'Vínculos que acompañan', description: 'Competencias parentales, apego, lactancia, desarrollo y primeros pasos.', color: '#527A45', path: 'c/' },
  { id: 'I', name: 'INFORMÁTICA', subtitle: 'Conocimiento para navegar', description: 'Información sanitaria digital, herramientas y uso responsable de la tecnología.', color: '#A86B4E', path: 'i/' },
  { id: 'B', name: 'BIENESTAR', subtitle: 'Cuidar también se aprende', description: 'Prevención, salud infantil, seguridad, hábitos saludables y señales de alerta.', color: '#9A762B', path: 'b/' },
  { id: 'A', name: 'ACOMPAÑAMIENTO', subtitle: 'Nadie cría en soledad', description: 'Orientación, conversación con especialistas y apoyo a las familias.', color: '#6E7C45', path: 'a/' }
];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
const articleUrl = (path: string) => SITE + path.replace(/^\//, '');
const sectionName = (id: string) => SECTIONS.find(s => s.id === id)?.name || 'CIBA';

export default function App() {
  const [screen, setScreen] = useState<'inicio' | 'biblioteca' | 'favoritos' | 'historial' | 'nayara'>('inicio');
  const [query, setQuery] = useState('');
  const [nayaraQuery, setNayaraQuery] = useState('');
  const [selected, setSelected] = useState('TODAS');
  const [menuOpen, setMenuOpen] = useState(false);
  const [reader, setReader] = useState<{ title: string; url: string; html?: string } | null>(null);
  const [readerCanGoBack, setReaderCanGoBack] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [activeArea, setActiveArea] = useState<CatalogArea | null>(null);
  const [activeSubsection, setActiveSubsection] = useState<CatalogSubsection | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [downloads, setDownloads] = useState<Record<string, SavedPage>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [nayaraAsked, setNayaraAsked] = useState(false);
  const webViewRef = useRef<any>(null);

  const persist = async (key: string, value: unknown) => {
    try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  const closeReader = () => { setReader(null); setReaderCanGoBack(false); };
  useEffect(() => {
    if (!reader) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (readerCanGoBack && !reader.html) webViewRef.current?.goBack();
      else closeReader();
      return true;
    });
    return () => subscription.remove();
  }, [reader, readerCanGoBack]);

  const applyCatalog = (data: Catalog) => {
    const safe: Catalog = {
      version: data.version || 1,
      generado: data.generado,
      columnas: Array.isArray(data.columnas) ? data.columnas : [],
      areas: Array.isArray(data.areas) ? data.areas : [],
      subsecciones: Array.isArray(data.subsecciones) ? data.subsecciones : [],
      paginas: Array.isArray(data.paginas) ? data.paginas.filter((p: Article) => p.estado === 'publicado' && !!p.ruta_publica) : []
    };
    setCatalog(safe);
    setArticles(safe.paginas);
    setCatalogState('ready');
    return safe;
  };

  const syncCatalog = async (quiet = false) => {
    if (!quiet) setSyncing(true);
    try {
      const response = await fetch(CATALOG_URL, { headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) throw new Error('Catálogo no disponible');
      const data = await response.json() as Catalog;
      const safe = applyCatalog(data);
      await AsyncStorage.setItem(KEYS.catalog, JSON.stringify(data));
      const stamp = data.generado || new Date().toISOString();
      setLastSync(stamp);
      if (!quiet) Alert.alert('CIBA actualizada', 'El índice de contenidos está actualizado. Tus favoritos, historial y artículos descargados se conservan.');
      return safe;
    } catch {
      if (!quiet) Alert.alert('No se pudo actualizar', 'Comprueba la conexión y vuelve a intentarlo. Se conservará el catálogo guardado en el teléfono.');
      return null;
    } finally { setSyncing(false); }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [savedCatalog, savedFavorites, savedHistory, savedDownloads] = await Promise.all([
        AsyncStorage.getItem(KEYS.catalog), AsyncStorage.getItem(KEYS.favorites),
        AsyncStorage.getItem(KEYS.history), AsyncStorage.getItem(KEYS.downloads)
      ]);
      if (!active) return;
      try { if (savedFavorites) setFavorites(JSON.parse(savedFavorites)); } catch {}
      try { if (savedHistory) setHistory(JSON.parse(savedHistory)); } catch {}
      try { if (savedDownloads) setDownloads(JSON.parse(savedDownloads)); } catch {}
      if (savedCatalog) {
        try { applyCatalog(JSON.parse(savedCatalog)); } catch { setCatalogState('error'); }
      }
      await syncCatalog(true);
      if (active && !savedCatalog) setCatalogState(current => current === 'loading' ? 'error' : current);
    };
    load();
    return () => { active = false; };
  }, []);

  const searchArticles = (text: string, section = 'TODAS') => {
    const q = normalize(text);
    if (q.length < 2) return [];
    return articles.filter(article => {
      const sectionMatch = section === 'TODAS' || article.columna === section;
      const searchable = normalize([
        article.titulo, article.descripcion || '', article.area || '',
        article.subseccion || '', ...(article.palabras_clave || [])
      ].join(' '));
      return sectionMatch && searchable.includes(q);
    }).slice(0, 40);
  };
  const visibleArticles = useMemo(() => searchArticles(query, selected), [articles, query, selected]);
  const nayaraResults = useMemo(() => searchArticles(nayaraQuery), [articles, nayaraQuery]);
  const visibleSections = useMemo(() => SECTIONS.filter(s => selected === 'TODAS' || s.id === selected), [selected]);

  const recordHistory = async (article: Article) => {
    const item: HistoryItem = { id: article.id, title: article.titulo, url: articleUrl(article.ruta_publica), viewedAt: Date.now() };
    const next = [item, ...history.filter(h => h.id !== article.id)].slice(0, 60);
    setHistory(next);
    await persist(KEYS.history, next);
  };

  const openArticle = async (article: Article) => {
    await recordHistory(article);
    const saved = downloads[article.id];
    if (saved) setReader({ title: article.titulo, url: saved.url, html: saved.html });
    else setReader({ title: article.titulo, url: articleUrl(article.ruta_publica) });
  };

  const downloadArticle = async (article: Article) => {
    setBusyId(article.id);
    try {
      const response = await fetch(articleUrl(article.ruta_publica), { headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) throw new Error('No se pudo descargar');
      const html = await response.text();
      const saved: SavedPage = { id: article.id, title: article.titulo, url: articleUrl(article.ruta_publica), html, savedAt: Date.now() };
      const next = { ...downloads, [article.id]: saved };
      setDownloads(next);
      await persist(KEYS.downloads, next);
      Alert.alert('Artículo guardado', 'El texto de este artículo ya está disponible en la biblioteca sin conexión. Las imágenes y otros recursos externos pueden necesitar Internet.');
    } catch {
      Alert.alert('Descarga no completada', 'No se pudo guardar el artículo. Comprueba la conexión e inténtalo de nuevo.');
    } finally { setBusyId(null); }
  };

  const removeDownload = async (id: string) => {
    const next = { ...downloads };
    delete next[id];
    setDownloads(next);
    await persist(KEYS.downloads, next);
  };
  const toggleFavorite = async (article: Article) => {
    const next = favorites.includes(article.id) ? favorites.filter(id => id !== article.id) : [article.id, ...favorites];
    setFavorites(next);
    await persist(KEYS.favorites, next);
  };
  const findArticle = (id: string) => articles.find(a => a.id === id);
  const favoriteArticles = favorites.map(findArticle).filter(Boolean) as Article[];
  const downloadedArticles = Object.values(downloads).sort((a,b) => b.savedAt - a.savedAt);
  const historyArticles = history.map(h => ({ ...h, article: findArticle(h.id) })).filter(h => !!h.article);

  const openSection = (section: Section) => {
    setScreen('inicio'); setActiveSection(section); setActiveArea(null); setActiveSubsection(null); setMenuOpen(false);
  };
  const openArea = (area: CatalogArea) => { setActiveArea(area); setActiveSubsection(null); };
  const backToAreas = () => { setActiveArea(null); setActiveSubsection(null); };
  const sectionAreas = catalog?.areas.filter(a => a.columna === activeSection?.id).sort((a,b) => (a.orden || 0) - (b.orden || 0)) || [];
  const areaSubsections = catalog?.subsecciones.filter(s => s.area === activeArea?.id && s.columna === activeSection?.id) || [];
  const areaArticles = catalog?.paginas.filter(a => a.area === activeArea?.id && !areaSubsections.some(s => a.ruta_publica.startsWith(s.ruta_publica))) || [];
  const subsectionArticles = catalog?.paginas.filter(a => !!activeSubsection && a.ruta_publica.startsWith(activeSubsection.ruta_publica)) || [];
  const openSite = () => Linking.openURL(SITE);
  const goHome = () => { setScreen('inicio'); setActiveSection(null); setActiveArea(null); setActiveSubsection(null); setQuery(''); setSelected('TODAS'); setMenuOpen(false); };

  const ArticleCard = ({ article, compact = false }: { article: Article; compact?: boolean }) => {
    const isFavorite = favorites.includes(article.id);
    const isDownloaded = !!downloads[article.id];
    return (
      <View style={styles.articleCard}>
        <TouchableOpacity accessibilityRole="button" onPress={() => openArticle(article)}>
          <Text style={styles.articleArea}>{sectionName(article.columna)}</Text>
          <Text style={styles.articleTitle}>{article.titulo}</Text>
          {!!article.descripcion && <Text style={styles.articleDescription} numberOfLines={compact ? 2 : 3}>{article.descripcion}</Text>}
          <Text style={styles.readLink}>{isDownloaded ? 'LEER · DISPONIBLE SIN CONEXIÓN' : 'LEER ARTÍCULO'}  ›</Text>
        </TouchableOpacity>
        <View style={styles.articleActions}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'} onPress={() => toggleFavorite(article)} style={styles.smallAction}>
            <Text style={styles.smallActionText}>{isFavorite ? '♥ Guardado' : '♡ Favorito'}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={isDownloaded ? 'Eliminar descarga' : 'Descargar artículo'} onPress={() => isDownloaded ? removeDownload(article.id) : downloadArticle(article)} style={styles.smallAction} disabled={busyId === article.id}>
            {busyId === article.id ? <ActivityIndicator size="small" color="#527A45" /> : <Text style={styles.smallActionText}>{isDownloaded ? '✓ Descargado' : '↓ Descargar'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <Modal visible={!!reader} animationType="slide" onRequestClose={closeReader}>
        <SafeAreaView style={styles.readerSafe}>
          <View style={styles.readerHeader}>
            <TouchableOpacity accessibilityRole="button" onPress={() => {
              if (readerCanGoBack && !reader?.html) webViewRef.current?.goBack(); else closeReader();
            }} style={styles.readerBack}><Text style={styles.readerBackText}>‹</Text></TouchableOpacity>
            <View style={styles.readerHeading}>
              <Text numberOfLines={1} style={styles.readerTitle}>{reader?.title || 'CIBA'}</Text>
              <Text style={styles.readerSubtitle}>CIBA · CRECEMOS ACOMPAÑÁNDONOS</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" onPress={closeReader} style={styles.readerClose}><Text style={styles.readerCloseText}>×</Text></TouchableOpacity>
          </View>
          {reader && <NativeWebView
            key={reader.html ? 'offline-' + reader.url : reader.url}
            ref={webViewRef}
            source={reader.html ? { html: reader.html, baseUrl: SITE } : { uri: reader.url }}
            style={styles.webView} javaScriptEnabled domStorageEnabled cacheEnabled
            setSupportMultipleWindows={false} originWhitelist={['https://*', 'file://*', 'data:*']}
            onNavigationStateChange={(state: { canGoBack: boolean }) => setReaderCanGoBack(state.canGoBack)}
            startInLoadingState
            renderLoading={() => <View style={styles.loading}><Text style={styles.loadingText}>Abriendo contenido de CIBA…</Text></View>}
          />}
          {reader?.html && <View style={styles.offlineBar}><Text style={styles.offlineText}>LECTURA GUARDADA · SIN CONEXIÓN</Text></View>}
        </SafeAreaView>
      </Modal>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.brand} onPress={goHome}>
          <Image source={require('./assets/icon.png')} style={styles.brandLogo} resizeMode="contain" />
          <View><Text style={styles.brandName}>CIBA</Text><Text style={styles.brandTag}>CRECEMOS ACOMPAÑÁNDONOS</Text></View>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir menú" style={styles.menuButton} onPress={() => setMenuOpen(!menuOpen)}>
          <Text style={styles.menuIcon}>{menuOpen ? '×' : '☰'}</Text>
        </TouchableOpacity>
      </View>

      {menuOpen && <View style={styles.menuPanel}>
        {[['Inicio', goHome], ['Mi biblioteca', () => { setScreen('biblioteca'); setMenuOpen(false); }], ['Favoritos', () => { setScreen('favoritos'); setMenuOpen(false); }], ['Historial', () => { setScreen('historial'); setMenuOpen(false); }], ['Dudas de Nayara', () => { setScreen('nayara'); setMenuOpen(false); }]].map(([label, action]: any) =>
          <TouchableOpacity key={label} style={styles.menuItem} onPress={action}><Text style={styles.menuItemText}>{label}</Text></TouchableOpacity>
        )}
        {SECTIONS.map(section => <TouchableOpacity key={section.id} style={styles.menuItem} onPress={() => openSection(section)}><Text style={styles.menuItemText}>{section.name}</Text></TouchableOpacity>)}
        <TouchableOpacity style={styles.menuItem} onPress={openSite}><Text style={styles.menuItemText}>Visitar CIBA en la web ↗</Text></TouchableOpacity>
      </View>}

      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {screen === 'inicio' && <>
          {!activeSection && <View style={styles.hero}>
            <Text style={styles.kicker}>EDUCACIÓN PARENTAL · PRIMEROS MIL DÍAS</Text>
            <Text style={styles.heroTitle}>Crecer en familia.{"\n"}Aprender acompañados.</Text>
            <Text style={styles.heroCopy}>Información comprensible y confiable para acompañar a niñas, niños y a quienes los cuidan.</Text>
            <View style={styles.heroRule} /><Text style={styles.heroFoot}>DESDE LA CONCEPCIÓN HASTA LOS DOS AÑOS</Text>
          </View>}

          {!activeSection && <View style={styles.quickGrid}>
            <TouchableOpacity style={styles.quickCard} onPress={() => setScreen('biblioteca')}><Text style={styles.quickNumber}>{downloadedArticles.length}</Text><Text style={styles.quickLabel}>LECTURAS GUARDADAS</Text></TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} onPress={() => setScreen('favoritos')}><Text style={styles.quickNumber}>{favorites.length}</Text><Text style={styles.quickLabel}>FAVORITOS</Text></TouchableOpacity>
            <TouchableOpacity style={styles.quickCard} onPress={() => setScreen('historial')}><Text style={styles.quickNumber}>{history.length}</Text><Text style={styles.quickLabel}>LECTURAS RECIENTES</Text></TouchableOpacity>
          </View>}

          {!activeSection && <View style={styles.searchBlock}>
            <Text style={styles.sectionTitle}>¿Qué necesitas saber hoy?</Text>
            <Text style={styles.muted}>Busca en los contenidos publicados de CIBA.</Text>
            <TextInput value={query} onChangeText={setQuery} placeholder="Ej. lactancia, sueño, desarrollo…" placeholderTextColor="#85877D" style={styles.searchInput} returnKeyType="search" accessibilityLabel="Buscar contenidos de CIBA" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {['TODAS', ...SECTIONS.map(s => s.id)].map(id => <TouchableOpacity key={id} onPress={() => setSelected(id)} style={[styles.filter, selected === id && styles.filterActive]}>
                <Text style={[styles.filterText, selected === id && styles.filterTextActive]}>{id === 'TODAS' ? 'Todas' : sectionName(id)}</Text>
              </TouchableOpacity>)}
            </ScrollView>
            {query.trim().length >= 2 && <View style={styles.searchResults}>
              <Text style={styles.searchResultsTitle}>Resultados</Text>
              {catalogState === 'loading' && <Text style={styles.searchHint}>Cargando el catálogo editorial…</Text>}
              {catalogState === 'error' && <Text style={styles.searchHint}>No se pudo cargar el catálogo. Revisa tu conexión o consulta la biblioteca guardada.</Text>}
              {catalogState === 'ready' && visibleArticles.length === 0 && <Text style={styles.searchHint}>No encontramos artículos con esas palabras. Prueba otra búsqueda.</Text>}
              {visibleArticles.map(article => <ArticleCard key={article.id} article={article} compact />)}
            </View>}
          </View>}

          <View style={styles.content}>
            {activeSection ? <>
              <TouchableOpacity style={styles.breadcrumb} onPress={() => {
                if (activeSubsection) setActiveSubsection(null);
                else if (activeArea) backToAreas();
                else setActiveSection(null);
              }}><Text style={styles.breadcrumbText}>‹  {activeSubsection ? activeArea?.titulo : activeArea ? activeSection.name : 'Volver a las cuatro áreas'}</Text></TouchableOpacity>
              <Text style={styles.sectionTitle}>{activeSubsection?.titulo || activeArea?.titulo || activeSection.name}</Text>
              <Text style={styles.muted}>{activeSubsection?.descripcion || activeArea?.descripcion || activeSection.description}</Text>
              {!catalog && <Text style={styles.searchHint}>Conéctate para guardar el índice editorial y explorar las secciones.</Text>}
              {catalog && !activeArea && sectionAreas.map(area => <TouchableOpacity key={area.id} style={styles.treeCard} onPress={() => openArea(area)}>
                <Text style={styles.treeTitle}>{area.titulo}</Text>{!!area.descripcion && <Text style={styles.treeDescription}>{area.descripcion}</Text>}<Text style={styles.treeLink}>EXPLORAR SECCIÓN  ›</Text>
              </TouchableOpacity>)}
              {catalog && activeArea && !activeSubsection && areaSubsections.map(sub => <TouchableOpacity key={sub.id} style={styles.treeCard} onPress={() => setActiveSubsection(sub)}>
                <Text style={styles.treeTitle}>{sub.titulo}</Text>{!!sub.descripcion && <Text style={styles.treeDescription}>{sub.descripcion}</Text>}<Text style={styles.treeLink}>VER CONTENIDOS  ›</Text>
              </TouchableOpacity>)}
              {catalog && (activeSubsection ? subsectionArticles : areaArticles).map(article => <ArticleCard key={article.id} article={article} />)}
              {catalog && activeSection && !activeArea && sectionAreas.length === 0 && <Text style={styles.searchHint}>No hay secciones publicadas en esta área todavía.</Text>}
              {catalog && activeArea && !activeSubsection && areaSubsections.length === 0 && areaArticles.length === 0 && <Text style={styles.searchHint}>Esta sección todavía no tiene contenidos publicados.</Text>}
              {catalog && activeSubsection && subsectionArticles.length === 0 && <Text style={styles.searchHint}>Esta subsección todavía no tiene artículos publicados.</Text>}
            </> : <>
              <View style={styles.contentHeading}><Text style={styles.sectionTitle}>Explora CIBA</Text><Text style={styles.muted}>{visibleSections.length} áreas</Text></View>
              {visibleSections.map(section => <TouchableOpacity key={section.id} activeOpacity={0.88} style={styles.sectionCard} onPress={() => openSection(section)}>
                <View style={[styles.cardAccent, { backgroundColor: section.color }]} /><View style={styles.cardBody}>
                  <Text style={[styles.cardLetter, { color: section.color }]}>{section.id}</Text><Text style={styles.cardTitle}>{section.name}</Text>
                  <Text style={styles.cardSubtitle}>{section.subtitle}</Text><Text style={styles.cardDescription}>{section.description}</Text>
                  <Text style={[styles.cardLink, { color: section.color }]}>EXPLORAR CONTENIDOS  ›</Text>
                </View>
              </TouchableOpacity>)}
            </>}
          </View>

          {!activeSection && <TouchableOpacity style={styles.nayara} onPress={() => setScreen('nayara')}>
            <View style={styles.nayaraOrb}><Text style={styles.nayaraOrbText}>N</Text></View><View style={styles.nayaraCopy}>
              <Text style={styles.nayaraTitle}>Dudas de Nayara</Text><Text style={styles.nayaraText}>Escribe una pregunta y encuentra publicaciones de CIBA relacionadas.</Text>
              <Text style={styles.nayaraLink}>EXPLORAR DUDAS  ›</Text>
            </View>
          </TouchableOpacity>}
          <TouchableOpacity style={styles.webButton} onPress={openSite}><Text style={styles.webButtonText}>ABRIR LA PLATAFORMA CIBA COMPLETA  ↗</Text></TouchableOpacity>
          <View style={styles.syncLine}>
            <Text style={styles.syncText}>{lastSync ? 'Índice actualizado: ' + new Date(lastSync).toLocaleDateString('es') : 'Sincroniza el índice de publicaciones'}</Text>
            <TouchableOpacity onPress={() => syncCatalog(false)} disabled={syncing} style={styles.syncButton}>
              {syncing ? <ActivityIndicator size="small" color="#527A45" /> : <Text style={styles.syncButtonText}>ACTUALIZAR</Text>}
            </TouchableOpacity>
          </View>
        </>}

        {screen === 'biblioteca' && <View style={styles.contentScreen}>
          <Text style={styles.kickerDark}>CONTENIDOS EN EL TELÉFONO</Text><Text style={styles.screenTitle}>Mi biblioteca</Text>
          <Text style={styles.muted}>Artículos guardados para consultar sin conexión.</Text>
          <Text style={styles.sectionTitleSmall}>Descargas · {downloadedArticles.length}</Text>
          {downloadedArticles.length === 0 && <Text style={styles.empty}>Todavía no has guardado artículos. Explora CIBA y pulsa «Descargar» en los que quieras conservar.</Text>}
          {downloadedArticles.map(item => {
            const article = findArticle(item.id);
            return <View key={item.id} style={styles.articleCard}>
              <TouchableOpacity onPress={() => setReader({ title: item.title, url: item.url, html: item.html })}><Text style={styles.articleTitle}>{item.title}</Text><Text style={styles.readLink}>ABRIR SIN CONEXIÓN  ›</Text></TouchableOpacity>
              <TouchableOpacity style={styles.removeButton} onPress={() => removeDownload(item.id)}><Text style={styles.removeText}>Eliminar descarga</Text></TouchableOpacity>
            </View>;
          })}
          <Text style={styles.libraryNote}>La descarga conserva el documento HTML y su texto. Imágenes, vídeos, audios y otros recursos alojados externamente pueden necesitar conexión.</Text>
        </View>}

        {screen === 'favoritos' && <View style={styles.contentScreen}>
          <Text style={styles.kickerDark}>TUS CONTENIDOS ELEGIDOS</Text><Text style={styles.screenTitle}>Favoritos</Text>
          <Text style={styles.muted}>Publicaciones que has marcado para volver a ellas.</Text>
          {favoriteArticles.length === 0 && <Text style={styles.empty}>Aún no tienes favoritos. Marca el corazón de un artículo para guardarlo aquí.</Text>}
          {favoriteArticles.map(article => <ArticleCard key={article.id} article={article} />)}
        </View>}

        {screen === 'historial' && <View style={styles.contentScreen}>
          <Text style={styles.kickerDark}>TU RECORRIDO</Text><Text style={styles.screenTitle}>Lecturas recientes</Text>
          <Text style={styles.muted}>Los últimos artículos que has abierto en este dispositivo.</Text>
          {historyArticles.length === 0 && <Text style={styles.empty}>Todavía no has abierto artículos desde esta aplicación.</Text>}
          {historyArticles.map(item => <ArticleCard key={item.id} article={item.article!} compact />)}
          {history.length > 0 && <TouchableOpacity style={styles.clearButton} onPress={() => Alert.alert('Borrar historial', '¿Quieres borrar las lecturas recientes de este dispositivo?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: async () => { setHistory([]); await persist(KEYS.history, []); } }])}><Text style={styles.clearText}>BORRAR HISTORIAL</Text></TouchableOpacity>}
        </View>}

        {screen === 'nayara' && <View style={styles.contentScreen}>
          <Text style={styles.kickerDark}>PREGUNTAS COTIDIANAS · INFORMACIÓN VERIFICADA</Text>
          <Text style={styles.screenTitle}>Dudas de Nayara</Text>
          <Text style={styles.nayaraIntro}>¿Qué te preocupa o qué necesitas comprender? Busca entre los artículos publicados por CIBA. Esta herramienta localiza contenidos relacionados; no genera diagnósticos ni sustituye una valoración profesional.</Text>
          <TextInput value={nayaraQuery} onChangeText={v => { setNayaraQuery(v); setNayaraAsked(false); }} placeholder="Escribe tu duda: sueño, lactancia, humo…" placeholderTextColor="#85877D" style={styles.searchInput} returnKeyType="search" onSubmitEditing={() => setNayaraAsked(true)} accessibilityLabel="Escribe tu duda para buscar en CIBA" />
          <TouchableOpacity style={styles.askButton} onPress={() => setNayaraAsked(true)}><Text style={styles.askButtonText}>BUSCAR EN CIBA</Text></TouchableOpacity>
          {nayaraAsked && <View style={styles.searchResults}>
            <Text style={styles.searchResultsTitle}>Publicaciones relacionadas</Text>
            {nayaraQuery.trim().length < 2 && <Text style={styles.searchHint}>Escribe al menos dos caracteres para buscar.</Text>}
            {nayaraQuery.trim().length >= 2 && nayaraResults.length === 0 && <Text style={styles.searchHint}>No encontramos una publicación con esas palabras. Prueba con términos más sencillos o consulta las cuatro áreas.</Text>}
            {nayaraResults.map(article => <ArticleCard key={article.id} article={article} compact />)}
          </View>}
          <View style={styles.safetyNote}><Text style={styles.safetyTitle}>Una orientación importante</Text><Text style={styles.safetyText}>Ante dificultad para respirar, convulsiones, pérdida de conciencia, coloración azulada o deterioro importante del estado general de un niño, busca atención médica urgente. No esperes una respuesta de la aplicación.</Text></View>
        </View>}

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>CIBA</Text><Text style={styles.footerText}>Crecemos acompañándonos.</Text>
          <Text style={styles.footerSmall}>Plataforma digital cubana de educación parental en los primeros mil días de las infancias.</Text>
          <Text style={styles.footerSmall}>Aplicación Android · Versión {APP_VERSION}</Text>
          <Text style={styles.footerSmall}>Sin cuentas de usuario ni recopilación de datos personales. Tus favoritos, historial y descargas permanecen en este dispositivo.</Text>
        </View>
      </ScrollView>
      <View style={styles.bottomNav}>
        {[
          ['inicio', '⌂', 'Inicio'], ['biblioteca', '▣', 'Biblioteca'], ['favoritos', '♡', 'Favoritos'], ['nayara', '◌', 'Nayara']
        ].map(([id, glyph, label]) => <TouchableOpacity key={id} accessibilityRole="button" accessibilityLabel={label} onPress={() => { setScreen(id as any); setActiveSection(null); setActiveArea(null); setActiveSubsection(null); setMenuOpen(false); }} style={styles.navItem}>
          <Text style={[styles.navGlyph, screen === id && styles.navActive]}>{glyph}</Text><Text style={[styles.navLabel, screen === id && styles.navActive]}>{label}</Text>
        </TouchableOpacity>)}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0E5' },
  page: { paddingBottom: 20, backgroundColor: '#F5F0E5' },
  topBar: { minHeight: 72, paddingHorizontal: 16, backgroundColor: '#263B2D', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#F8F1E7' },
  brandName: { color: '#F8F1E7', fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  brandTag: { color: '#D7B77B', fontSize: 7, letterSpacing: 1.2, marginTop: 2 },
  menuButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { color: '#F8F1E7', fontSize: 26 },
  menuPanel: { backgroundColor: '#344C39', paddingHorizontal: 20, paddingVertical: 7 },
  menuItem: { minHeight: 45, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#6D8068' },
  menuItemText: { color: '#F8F1E7', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  hero: { paddingHorizontal: 23, paddingTop: 37, paddingBottom: 31, backgroundColor: '#263B2D' },
  kicker: { color: '#D7B77B', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  kickerDark: { color: '#A86B4E', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: '#FFFDF7', fontFamily: 'Georgia', fontSize: 34, lineHeight: 41, marginTop: 18 },
  heroCopy: { color: '#E1E4D9', fontSize: 13, lineHeight: 21, marginTop: 14 },
  heroRule: { width: 52, height: 2, backgroundColor: '#B96F4F', marginTop: 22, marginBottom: 13 },
  heroFoot: { color: '#D7B77B', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  quickGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  quickCard: { flex: 1, minHeight: 75, backgroundColor: '#E9E0CF', borderRadius: 9, padding: 10, justifyContent: 'center' },
  quickNumber: { color: '#263B2D', fontFamily: 'Georgia', fontSize: 24 },
  quickLabel: { color: '#6B6C5C', fontSize: 7, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 },
  searchBlock: { paddingHorizontal: 19, paddingTop: 27, paddingBottom: 21, backgroundColor: '#FFFDF7', borderBottomWidth: 1, borderBottomColor: '#E4DDCF' },
  sectionTitle: { color: '#263B2D', fontFamily: 'Georgia', fontSize: 24, fontWeight: '400' },
  sectionTitleSmall: { color: '#263B2D', fontFamily: 'Georgia', fontSize: 20, marginTop: 25, marginBottom: 8 },
  muted: { color: '#73776D', fontSize: 12, lineHeight: 18, marginTop: 5 },
  searchInput: { minHeight: 49, borderWidth: 1, borderColor: '#DDD4C3', borderRadius: 9, paddingHorizontal: 14, marginTop: 16, color: '#29332D', backgroundColor: '#FFFFFF', fontSize: 13 },
  filters: { gap: 7, paddingTop: 12, paddingBottom: 2 },
  filter: { borderWidth: 1, borderColor: '#D8D0C1', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
  filterActive: { backgroundColor: '#263B2D', borderColor: '#263B2D' },
  filterText: { color: '#526057', fontSize: 9, fontWeight: '700' },
  filterTextActive: { color: '#FFFDF7' },
  searchResults: { marginTop: 19, gap: 9 },
  searchResultsTitle: { color: '#263B2D', fontFamily: 'Georgia', fontSize: 19, marginBottom: 2 },
  searchHint: { color: '#73776D', fontSize: 12, lineHeight: 18 },
  content: { paddingHorizontal: 19, paddingTop: 28 },
  contentScreen: { paddingHorizontal: 19, paddingTop: 29, paddingBottom: 25 },
  contentHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 15 },
  sectionCard: { flexDirection: 'row', backgroundColor: '#FFFDF7', borderWidth: 1, borderColor: '#E4DDCF', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  cardAccent: { width: 6 },
  cardBody: { flex: 1, padding: 16 },
  cardLetter: { fontFamily: 'Georgia', fontSize: 25 },
  cardTitle: { color: '#263B2D', fontSize: 14, fontWeight: '900', letterSpacing: 1, marginTop: 3 },
  cardSubtitle: { color: '#A86B4E', fontSize: 12, fontWeight: '700', marginTop: 6 },
  cardDescription: { color: '#626A60', fontSize: 12, lineHeight: 18, marginTop: 6 },
  cardLink: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 12 },
  articleCard: { padding: 14, borderWidth: 1, borderColor: '#E4DDCF', borderRadius: 10, backgroundColor: '#FFFDF7', marginTop: 10 },
  articleArea: { color: '#A86B4E', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  articleTitle: { color: '#263B2D', fontFamily: 'Georgia', fontSize: 17, lineHeight: 23, marginTop: 5 },
  articleDescription: { color: '#626A60', fontSize: 11, lineHeight: 17, marginTop: 5 },
  readLink: { color: '#527A45', fontSize: 9, fontWeight: '900', letterSpacing: 0.7, marginTop: 10 },
  articleActions: { flexDirection: 'row', gap: 10, marginTop: 11, borderTopWidth: 1, borderTopColor: '#EEE7DA', paddingTop: 9 },
  smallAction: { minHeight: 36, minWidth: 100, paddingHorizontal: 9, justifyContent: 'center' },
  smallActionText: { color: '#6B6C5C', fontSize: 10, fontWeight: '800' },
  treeCard: { padding: 15, borderWidth: 1, borderColor: '#E4DDCF', borderRadius: 10, backgroundColor: '#FFFDF7', marginTop: 11 },
  treeTitle: { color: '#263B2D', fontFamily: 'Georgia', fontSize: 18, lineHeight: 24 },
  treeDescription: { color: '#626A60', fontSize: 12, lineHeight: 18, marginTop: 5 },
  treeLink: { color: '#527A45', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 11 },
  breadcrumb: { alignSelf: 'flex-start', paddingVertical: 9, paddingRight: 12, marginBottom: 10 },
  breadcrumbText: { color: '#A86B4E', fontSize: 12, fontWeight: '800' },
  nayara: { flexDirection: 'row', gap: 13, marginHorizontal: 18, marginTop: 23, padding: 16, borderRadius: 13, backgroundColor: '#E9DDC9', borderWidth: 1, borderColor: '#D8C6A8' },
  nayaraOrb: { width: 45, height: 45, borderRadius: 23, backgroundColor: '#D7B77B', alignItems: 'center', justifyContent: 'center' },
  nayaraOrbText: { color: '#493A32', fontFamily: 'Georgia', fontSize: 24 },
  nayaraCopy: { flex: 1 },
  nayaraTitle: { color: '#493A32', fontFamily: 'Georgia', fontSize: 19 },
  nayaraText: { color: '#5B554B', fontSize: 11, lineHeight: 17, marginTop: 5 },
  nayaraLink: { color: '#527A45', fontSize: 9, fontWeight: '900', marginTop: 8 },
  nayaraIntro: { color: '#626A60', fontSize: 13, lineHeight: 21, marginTop: 10 },
  askButton: { minHeight: 46, backgroundColor: '#527A45', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 11 },
  askButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  safetyNote: { backgroundColor: '#EEE7DA', borderRadius: 10, padding: 14, marginTop: 24 },
  safetyTitle: { color: '#754A38', fontWeight: '900', fontSize: 12 },
  safetyText: { color: '#5B554B', fontSize: 11, lineHeight: 18, marginTop: 6 },
  webButton: { marginHorizontal: 18, marginTop: 22, paddingVertical: 15, borderRadius: 7, backgroundColor: '#A86B4E', alignItems: 'center' },
  webButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  syncLine: { marginHorizontal: 19, marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  syncText: { flex: 1, color: '#85877D', fontSize: 9 },
  syncButton: { minHeight: 36, minWidth: 92, alignItems: 'center', justifyContent: 'center' },
  syncButtonText: { color: '#527A45', fontSize: 9, fontWeight: '900' },
  screenTitle: { color: '#263B2D', fontFamily: 'Georgia', fontSize: 29, marginTop: 8 },
  empty: { color: '#73776D', fontSize: 12, lineHeight: 19, paddingVertical: 20 },
  libraryNote: { color: '#77776A', fontSize: 10, lineHeight: 16, marginTop: 18 },
  removeButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 2 },
  removeText: { color: '#A86B4E', fontSize: 10, fontWeight: '800' },
  clearButton: { marginTop: 18, alignSelf: 'flex-start', padding: 12, borderWidth: 1, borderColor: '#D8C6A8', borderRadius: 7 },
  clearText: { color: '#A86B4E', fontSize: 9, fontWeight: '900' },
  footer: { marginTop: 28, paddingHorizontal: 23, paddingTop: 25, paddingBottom: 18, backgroundColor: '#1C3025' },
  footerBrand: { color: '#D7B77B', fontSize: 23, fontWeight: '900', letterSpacing: 4 },
  footerText: { color: '#F5F0E5', fontFamily: 'Georgia', fontSize: 16, marginTop: 5 },
  footerSmall: { color: '#C1C8B9', fontSize: 9, lineHeight: 15, marginTop: 8 },
  bottomNav: { minHeight: 61, flexDirection: 'row', backgroundColor: '#FFFDF7', borderTopWidth: 1, borderTopColor: '#E4DDCF', justifyContent: 'space-around', alignItems: 'center' },
  navItem: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  navGlyph: { color: '#888B7D', fontSize: 20 },
  navLabel: { color: '#888B7D', fontSize: 8, fontWeight: '700', marginTop: 2 },
  navActive: { color: '#527A45' },
  readerSafe: { flex: 1, backgroundColor: '#F5F0E5' },
  readerHeader: { minHeight: 58, paddingHorizontal: 10, backgroundColor: '#263B2D', flexDirection: 'row', alignItems: 'center' },
  readerBack: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
  readerBackText: { color: '#D7B77B', fontSize: 34, lineHeight: 38 },
  readerHeading: { flex: 1, paddingHorizontal: 8 },
  readerTitle: { color: '#FFFDF7', fontSize: 13, fontWeight: '800' },
  readerSubtitle: { color: '#D7B77B', fontSize: 7, letterSpacing: 1, marginTop: 3 },
  readerClose: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  readerCloseText: { color: '#FFFDF7', fontSize: 27 },
  webView: { flex: 1, backgroundColor: '#F5F0E5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F0E5' },
  loadingText: { color: '#527A45', fontSize: 13 },
  offlineBar: { backgroundColor: '#E9DDC9', paddingVertical: 7, alignItems: 'center' },
  offlineText: { color: '#527A45', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }
});
