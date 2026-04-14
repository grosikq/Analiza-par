import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, StatusBar, SafeAreaView, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fca_V';

const C = {
  bg:       '#f3f3f3',
  surface:  '#FFFFFF',
  border:   '#E4E7EC',
  accent:   '#444256', 
  accentLt: '#bad8ff',
  text:     '#111827',
  sub:      '#6B7280',
  muted:    '#9CA3AF',
  danger:   '#EF4444',
  dangerLt: '#FEF2F2',
  green:    '#059669',
  greenLt:  '#ECFDF5',
  gold:     '#efb767',
  silver:   '#747874',
  bronze:   '#9c5b2f',
};

// --- LOGIKA ---
function calcScores(factors, pairs) {
  const sc = factors.map(() => 0);
  pairs.forEach(p => {
    if (p.answer === 'a') sc[p.a] += 2;
    else if (p.answer === 'b') sc[p.b] += 2;
    else if (p.answer === 'eq') { sc[p.a]++; sc[p.b]++; }
  });
  const sorted = factors
    .map((name, i) => ({ name, pts: sc[i] }))
    .sort((a, b) => b.pts - a.pts);
  let currentRank = 0;
  let lastPts = null;
  return sorted.map((item) => {
    if (item.pts !== lastPts) { currentRank++; lastPts = item.pts; }
    return { ...item, rank: currentRank };
  });
}
function generatePairs(factors) {
  const pairs = [];
  for (let i = 0; i < factors.length; i++)
    for (let j = i + 1; j < factors.length; j++)
      pairs.push({ a: i, b: j, answer: null });
  return pairs;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function ansLabel(factors, pair) {
  if (pair.answer === 'a') return factors[pair.a];
  if (pair.answer === 'b') return factors[pair.b];
  if (pair.answer === 'eq') return 'Równe';
  return null;
}

export default function App() {
  const [view, setView]                 = useState('saved');
  const [sets, setSets]                 = useState([]);
  const [cur, setCur]                   = useState(null);
  const [activeIdx, setActiveIdx]       = useState(0); 
  const [editIdx, setEditIdx]           = useState(null);
  const [factorInput, setFactorInput]   = useState('');
  const [factors, setFactors]           = useState([]);
  const [question, setQuestion]         = useState('Który czynnik jest ważniejszy?');
  const [analysisName, setAnalysisName] = useState('');
  const [resultsTab, setResultsTab]     = useState('ranking');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => { if (v) setSets(JSON.parse(v)); });
  }, []);

  function persist(newSets) {
    setSets(newSets);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSets));
  }

  const resetSetupForm = () => {
    setAnalysisName('');
    setQuestion('Który czynnik jest ważniejszy?');
    setFactors([]);
    setFactorInput('');
  };

  function syncCurrent(updated) {
    setCur(updated);
    persist(sets.map(s => s.id === updated.id ? updated : s));
  }

  function addFactor() {
    const v = factorInput.trim();
    if (!v || factors.length >= 20 || factors.includes(v)) { setFactorInput(''); return; }
    setFactors(p => [...p, v]);
    setFactorInput('');
  }

  function startAnalysis() {
    const name = analysisName.trim() || ('Analiza ' + new Date().toLocaleDateString('pl'));
    const newSet = {
      id: uid(), name,
      question: question.trim() || 'Który czynnik jest ważniejszy?',
      factors: [...factors],
      pairs: generatePairs(factors),
    };
    persist([...sets, newSet]);
    setCur(newSet);
    setActiveIdx(0);
    resetSetupForm();
    setView('compare');
  }

  function loadSet(id) {
    const s = sets.find(s => s.id === id);
    if (!s) return;
    setCur(s);
    setResultsTab('ranking');
    const firstNull = s.pairs.findIndex(p => p.answer === null);
    setActiveIdx(firstNull === -1 ? 0 : firstNull);
    setView(firstNull === -1 ? 'results' : 'compare');
  }

  function answer(choice) {
    const updated = { ...cur, pairs: cur.pairs.map((p, i) => i === activeIdx ? { ...p, answer: choice } : p) };
    syncCurrent(updated);
    if (activeIdx < cur.pairs.length - 1) setActiveIdx(activeIdx + 1);
    else setView('results');
  }

  function resetAllPairs() {
    Alert.alert('Zacznij od nowa', 'Wyczyścić wszystkie odpowiedzi?', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Tak', style: 'destructive', onPress: () => {
        const updated = { ...cur, pairs: cur.pairs.map(p => ({ ...p, answer: null })) };
        syncCurrent(updated);
        setActiveIdx(0);
        setView('compare');
      }},
    ]);
  }

  function editAnswer(choice) {
    const updated = { ...cur, pairs: cur.pairs.map((p, i) => i === editIdx ? { ...p, answer: choice } : p) };
    syncCurrent(updated);
    setView('editPairs');
  }

  // --- VIEWS ---
  if (view === 'saved') return (
    <Screen title="Analizy par" action={{ label: '+ Nowa analiza', onPress: () => { resetSetupForm(); setView('setup'); } }}>
      {sets.length === 0
        ? <Card style={{ alignItems: 'center', paddingVertical: 48 }}><Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>Lista jest pusta</Text></Card>
        : sets.slice().reverse().map(sv => {
          const answered = sv.pairs.filter(p => p.answer !== null).length;
          const total = sv.pairs.length;
          return (
            <Card key={sv.id} style={{ padding: 0, overflow: 'hidden' }}>
              <TouchableOpacity style={st.savedMain} onPress={() => loadSet(sv.id)}>
                <Text style={st.savedTitle}>{sv.name}</Text>
                <Text style={st.savedMeta}>Czynniki: {sv.factors.length}  ·  Postęp: {answered}/{total}</Text>
                <View style={st.progBg2}><View style={[st.progBar2, { width: `${(answered/total)*100}%`, backgroundColor: answered === total ? C.green : C.accent }]} /></View>
              </TouchableOpacity>
              <View style={st.savedActions}>
                <TouchableOpacity style={st.savedOpen} onPress={() => loadSet(sv.id)}><Text style={{ color: C.accent, fontWeight: '600' }}>Otwórz</Text></TouchableOpacity>
                <TouchableOpacity style={st.savedDel} onPress={() => persist(sets.filter(s => s.id !== sv.id))}><Text style={{ color: C.danger, fontWeight: '600' }}>Usuń</Text></TouchableOpacity>
              </View>
            </Card>
          );
        })}
    </Screen>
  );

  if (view === 'setup') return (
    <Screen title="Kreator" action={{ label: 'Lista', onPress: () => setView('saved') }}>
      <Card>
        <FieldLabel>Nazwa analizy</FieldLabel>
        <TextInput style={st.input} value={analysisName} onChangeText={setAnalysisName} />
        <FieldLabel style={{ marginTop: 12 }}>Pytanie</FieldLabel>
        <TextInput style={st.input} value={question} onChangeText={setQuestion} />
        <FieldLabel style={{ marginTop: 12 }}>Dodaj czynniki (max 20)</FieldLabel>
        <View style={st.row}>
          <TextInput style={[st.input, { flex: 1, marginBottom: 0 }]} value={factorInput} onChangeText={setFactorInput} onSubmitEditing={addFactor} placeholder="Np. Cena, Jakość..." />
          <PrimaryBtn label="+" onPress={addFactor} disabled={!factorInput.trim() || factors.length >= 20} style={{ marginLeft: 8, paddingHorizontal: 20, paddingVertical: 12, marginBottom: 0  }} />
        </View>
        
        <View style={st.factorList}>
          {factors.map((f, i) => (
            <View key={i} style={st.factorItem}>
              <Text style={st.factorItemText} numberOfLines={2}>{f}</Text>
              <TouchableOpacity 
                onPress={() => setFactors(prev => prev.filter((_, idx) => idx !== i))} 
                style={st.deleteBtn}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <Text style={st.deleteBtnIcon}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {factors.length === 0 && (
            <Text style={st.emptyListHint}>Dodaj przynajmniej 2 czynniki, aby zacząć.</Text>
          )}
        </View>
      </Card>
      {factors.length >= 2 && <PrimaryBtn label="Rozpocznij analizę →" onPress={startAnalysis} />}
    </Screen>
  );

  if (view === 'compare' && cur) {
    const p = cur.pairs[activeIdx];
    const fA = cur.factors[p.a], fB = cur.factors[p.b];
    const total = cur.pairs.length;
    const answeredTotal = cur.pairs.filter(q => q.answer !== null).length;
    return (
      <Screen title={cur.name} action={{ label: 'Zakończ', onPress: () => setView('saved') }}>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <View style={st.progBg}><View style={[st.progBar, { width: `${((activeIdx + 1) / total) * 100}%` }]} /></View>
          <View style={st.tinderCard}>
            <Text style={st.stepLabel}>PARA {activeIdx + 1} Z {total}</Text>
            <Text style={st.pairQ}>{cur.question}</Text>
            <View style={st.tinderSideBySide}>
                <View style={st.tinderHalf}>
                  <Text style={st.optionIndicator}>A</Text>
                  <Text style={st.tinderFactor} numberOfLines={3}>{fA}</Text>
                </View>
                <View style={st.tinderVsCircle}><Text style={st.tinderVsTxt}>VS</Text></View>
                <View style={st.tinderHalf}>
                  <Text style={st.optionIndicator}>B</Text>
                  <Text style={st.tinderFactor} numberOfLines={3}>{fB}</Text>
                </View>
            </View>
          </View>
          <View style={st.tinderActions}>
            <View style={st.tinderRow}>
                <TouchableOpacity style={[st.tinderBtn, { borderColor: C.accent }, p.answer === 'a' && { backgroundColor: C.accentLt }]} onPress={() => answer('a')}>
                    <Text style={[st.tinderBtnTxt, { color: C.accent, fontSize: 18 }]}>A</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.tinderBtn, { borderColor: C.accent }, p.answer === 'eq' && { backgroundColor: C.accentLt }]} onPress={() => answer('eq')}>
                    <Text style={[st.tinderBtnTxt, { color: C.accent, fontSize: 18 }]}>=</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.tinderBtn, { borderColor: C.accent }, p.answer === 'b' && { backgroundColor: C.accentLt }]} onPress={() => answer('b')}>
                    <Text style={[st.tinderBtnTxt, { color: C.accent, fontSize: 18 }]}>B</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity style={st.navFullBtn} onPress={() => setView('results')} disabled={answeredTotal === 0}>
                <Text style={st.navFullBtnTxt}>Wyniki częściowe</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.navFullBtn, { opacity: activeIdx === 0 ? 0.3 : 1 }]} onPress={() => activeIdx > 0 && setActiveIdx(activeIdx - 1)} disabled={activeIdx === 0}>
                <Text style={st.navFullBtnTxt}>Cofnij</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Screen>
    );
  }

  if (view === 'results' && cur) {
    const ranked = calcScores(cur.factors, cur.pairs);
    const maxPts = ranked[0]?.pts || 1;
    const medals = [C.gold, C.silver, C.bronze];
    return (
      <Screen title={cur.name} action={{ label: 'Lista', onPress: () => setView('saved') }}>
        {cur.pairs.filter(p => p.answer !== null).length < cur.pairs.length && (
          <View style={[st.banner, { backgroundColor: C.accentLt }]}>
            <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>Wyniki częściowe.</Text>
            <TouchableOpacity onPress={() => setView('compare')} style={{ marginTop: 6 }}>
              <Text style={{ color: C.accent, fontWeight: '800', fontSize: 13 }}>Kontynuuj porównywanie →</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={st.tabs}>
          <TouchableOpacity style={[st.tab, resultsTab === 'ranking' && st.tabActive]} onPress={() => setResultsTab('ranking')}><Text style={[st.tabTxt, resultsTab === 'ranking' && st.tabTxtActive]}>Ranking</Text></TouchableOpacity>
          <TouchableOpacity style={[st.tab, resultsTab === 'odpowiedzi' && st.tabActive]} onPress={() => setResultsTab('odpowiedzi')}><Text style={[st.tabTxt, resultsTab === 'odpowiedzi' && st.tabTxtActive]}>Odpowiedzi</Text></TouchableOpacity>
        </View>
        {resultsTab === 'ranking' ? (
          <Card>
            {ranked.map((r, i) => {
              const medalColor = medals[r.rank - 1] || C.muted;
              return (
                <View key={i} style={[st.rankRow, i < ranked.length - 1 && st.rankDivider]}>
                  <View style={[st.medal, { backgroundColor: medalColor + '22' }]}><Text style={[st.medalTxt, { color: medalColor }]}>{r.rank}</Text></View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={st.rankName}>{r.name}</Text>
                    <View style={st.barBg}><View style={[st.barFill, { width: `${(r.pts / maxPts) * 100}%`, backgroundColor: medalColor }]} /></View>
                  </View>
                  <Text style={st.rankPts}>{r.pts} pkt</Text>
                </View>
              );
            })}
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {cur.pairs.map((p, i) => (
              <View key={i} style={[st.pairRow, i < cur.pairs.length - 1 && st.pairDivider]}>
                <Text style={st.pairRowLabel} numberOfLines={1}>{cur.factors[p.a]} vs {cur.factors[p.b]}</Text>
                <View style={[st.ansBadge, { backgroundColor: C.accentLt }]}><Text style={[st.ansBadgeTxt, { color: C.accent }]}>{ansLabel(cur.factors, p) || '-'}</Text></View>
              </View>
            ))}
          </Card>
        )}
        <TouchableOpacity style={st.ghostBtn} onPress={() => setView('editPairs')}><Text style={st.ghostBtnTxt}>Popraw wybrane odpowiedzi</Text></TouchableOpacity>
        <TouchableOpacity style={[st.ghostBtn, { borderColor: C.danger }]} onPress={resetAllPairs}><Text style={[st.ghostBtnTxt, { color: C.danger }]}>Przeprowadź analizę od nowa</Text></TouchableOpacity>
      </Screen>
    );
  }

  if (view === 'editPairs' && cur) return (
    <Screen title="Edycja listy" action={{ label: 'Wyniki', onPress: () => setView('results') }}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {cur.pairs.map((p, i) => (
          <TouchableOpacity key={i} style={[st.pairRow, i < cur.pairs.length - 1 && st.pairDivider]} onPress={() => { setEditIdx(i); setView('editOne'); }}>
            <Text style={st.pairRowLabel} numberOfLines={1}>{cur.factors[p.a]} vs {cur.factors[p.b]}</Text>
            <View style={[st.ansBadge, { backgroundColor: p.answer ? C.accentLt : C.bg }]}><Text style={st.ansBadgeTxt}>{ansLabel(cur.factors, p) || '—'}</Text></View>
          </TouchableOpacity>
        ))}
      </Card>
    </Screen>
  );

  if (view === 'editOne' && cur && editIdx !== null) {
    const p = cur.pairs[editIdx];
    return (
      <Screen title="Zmień odpowiedź" action={{ label: 'Anuluj', onPress: () => setView('editPairs') }}>
        <View style={{ alignItems: 'center' }}>
          <View style={st.tinderCard}>
            <Text style={st.pairQ}>{cur.question}</Text>
            <View style={st.tinderSideBySide}>
                <View style={st.tinderHalf}>
                  <Text style={st.optionIndicator}>A</Text>
                  <Text style={st.tinderFactor} numberOfLines={3}>{cur.factors[p.a]}</Text>
                </View>
                <View style={st.tinderVsCircle}><Text style={st.tinderVsTxt}>VS</Text></View>
                <View style={st.tinderHalf}>
                  <Text style={st.optionIndicator}>B</Text>
                  <Text style={st.tinderFactor} numberOfLines={3}>{cur.factors[p.b]}</Text>
                </View>
            </View>
          </View>
          <View style={st.tinderActions}>
            <View style={st.tinderRow}>
                <TouchableOpacity style={[st.tinderBtn, { borderColor: C.accent }, p.answer === 'a' && { backgroundColor: C.accentLt }]} onPress={() => editAnswer('a')}>
                    <Text style={[st.tinderBtnTxt, { color: C.accent, fontSize: 18 }]}>A</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.tinderBtn, { borderColor: C.accent }, p.answer === 'eq' && { backgroundColor: C.accentLt }]} onPress={() => editAnswer('eq')}>
                    <Text style={[st.tinderBtnTxt, { color: C.accent, fontSize: 18 }]}>=</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.tinderBtn, { borderColor: C.accent }, p.answer === 'b' && { backgroundColor: C.accentLt }]} onPress={() => editAnswer('b')}>
                    <Text style={[st.tinderBtnTxt, { color: C.accent, fontSize: 18 }]}>B</Text>
                </TouchableOpacity>
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  return null;
}

// --- KOMPONENTY ---
function Screen({ title, action, children }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <View style={st.header}>
        <Text style={st.headerTitle} numberOfLines={1}>{title}</Text>
        {action && <TouchableOpacity onPress={action.onPress}><Text style={st.headerAction}>{action.label}</Text></TouchableOpacity>}
      </View>
      <ScrollView contentContainerStyle={st.screen} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    </SafeAreaView>
  );
}
function Card({ children, style }) { return <View style={[st.card, style]}>{children}</View>; }
function FieldLabel({ children, style }) { return <Text style={[st.fieldLabel, style]}>{children}</Text>; }
function PrimaryBtn({ label, onPress, disabled, style }) {
  return (<TouchableOpacity style={[st.primaryBtn, style, disabled && { backgroundColor: C.border }]} onPress={onPress} disabled={disabled}><Text style={[st.primaryBtnTxt, disabled && { color: C.muted }]}>{label}</Text></TouchableOpacity>);
}

// --- STYLE ---
const st = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text, flex: 1 },
  headerAction: { fontSize: 14, fontWeight: '600', color: C.accent },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.sub, marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, color: C.text, padding: 11, borderRadius: 10, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center' },
  factorList: { marginTop: 16 },
  factorItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, justifyContent: 'space-between' },
  factorItemText: { color: C.text, fontSize: 15, fontWeight: '500', flex: 1, marginRight: 10 },
  deleteBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  deleteBtnIcon: { fontSize: 20, color: C.danger },
  emptyListHint: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
  primaryBtn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  primaryBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghostBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: C.border, marginTop: 8 },
  ghostBtnTxt: { color: C.sub, fontSize: 15, fontWeight: '600' },
  tinderCard: { width: '100%', height: 210, backgroundColor: '#fff', borderRadius: 25, padding: 18, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, borderWidth: 1, borderColor: C.border },
  tinderSideBySide: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tinderHalf: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  optionIndicator: { fontSize: 11, fontWeight: '900', color: C.muted, marginBottom: 8, letterSpacing: 1 },
  tinderFactor: { fontSize: 15, fontWeight: '800', color: C.text, textAlign: 'center' },
  tinderVsCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, marginHorizontal: 8, marginTop: 15 },
  tinderVsTxt: { fontSize: 9, fontWeight: '900', color: C.muted },
  tinderActions: { width: '100%', marginTop: 20, gap: 8 },
  tinderRow: { flexDirection: 'row', gap: 8 },
  tinderBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 2, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tinderBtnTxt: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  navFullBtn: { width: '100%', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', alignItems: 'center' },
  navFullBtnTxt: { color: C.sub, fontWeight: '600', fontSize: 14 },
  stepLabel: { fontSize: 10, color: C.muted, fontWeight: '800', textAlign: 'center', letterSpacing: 1, marginBottom: 8 },
  progBg: { width: '100%', height: 6, backgroundColor: C.border, borderRadius: 3, marginBottom: 16 },
  progBar: { height: 6, backgroundColor: C.accent, borderRadius: 3 },
  pairQ: { fontSize: 12, color: C.sub, textAlign: 'center', marginBottom: 5 },
  banner: { borderRadius: 12, padding: 14, marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive: { backgroundColor: C.accent },
  tabTxt: { fontSize: 14, fontWeight: '600', color: C.sub },
  tabTxtActive: { color: '#fff' },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rankDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
  medal: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  medalTxt: { fontSize: 14, fontWeight: '800' },
  rankName: { fontSize: 14, fontWeight: '600' },
  barBg: { height: 5, backgroundColor: C.border, borderRadius: 3, marginTop: 5 },
  barFill: { height: 5, borderRadius: 3 },
  rankPts: { fontSize: 13, color: C.sub, minWidth: 52, textAlign: 'right' },
  pairRow: { flexDirection: 'row', alignItems: 'center', padding: 13 },
  pairDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
  pairRowLabel: { flex: 1, fontSize: 13 },
  ansBadge: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, marginLeft: 8 },
  ansBadgeTxt: { fontSize: 12, fontWeight: '600' },
  savedMain: { padding: 16 },
  savedTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  savedMeta: { fontSize: 12, color: C.muted, marginTop: 4, marginBottom: 8 },
  progBg2: { height: 4, backgroundColor: C.border, borderRadius: 2 },
  progBar2: { height: 4, borderRadius: 2 },
  savedActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
  savedOpen: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRightWidth: 1, borderRightColor: C.border },
  savedDel: { flex: 1, paddingVertical: 11, alignItems: 'center' },
});