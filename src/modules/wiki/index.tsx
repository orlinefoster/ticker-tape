import { useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { useUIStore } from '@/store/uiStore';
import { WIKI_ARTICLES } from './articles';
import { InteractiveExoWidget } from './components/InteractiveExoWidget';

export default function WikiModule() {
  const { setActiveRoute } = useUIStore();
  const [selectedArticleId, setSelectedArticleId] = useState<string>('estudio-equity-curve');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = ['ALL', 'Administración de Cartera', 'Modelos Cuantitativos', 'Gestión del Riesgo', 'Estructura de Mercado'];

  const filteredArticles = WIKI_ARTICLES.filter((art) => {
    const matchesCategory = selectedCategory === 'ALL' || art.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      art.title.toLowerCase().includes(q) ||
      art.summary.toLowerCase().includes(q) ||
      art.content.toLowerCase().includes(q);

    return matchesCategory && matchesQuery;
  });

  const currentArticle = WIKI_ARTICLES.find((a) => a.id === selectedArticleId) || WIKI_ARTICLES[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>📚</span>
            <h1 className="holo-gradient-text" style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0 }}>
              Wiki &amp; Base de Conocimiento Financiero
            </h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Guía de referencia teórica, modelos cuantitativos de cartera, fórmulas matemáticas y simuladores interactivos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button size="sm" variant="holo" onClick={() => setActiveRoute('/cartera')}>
            ⚡ Ir a Cartera
          </Button>
          <Button size="sm" variant="sakura" onClick={() => setActiveRoute('/chart')}>
            📉 Ir a #Gráficos
          </Button>
        </div>
      </div>

      {/* Main Layout: Left Sidebar List + Right Article Reader */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left: Search, Filter, Articles Index */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Search Input */}
          <input
            type="search"
            role="searchbox"
            aria-label="Buscar conceptos y fórmulas en la base de conocimiento"
            placeholder="🔍 Buscar conceptos, fórmulas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(21, 25, 38, 0.85)',
              color: 'var(--text-bright)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />

          {/* Category Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }} role="group" aria-label="Filtrar por categoría">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: selectedCategory === cat ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedCategory === cat ? 'var(--accent)' : 'var(--border)',
                  color: selectedCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                  fontWeight: selectedCategory === cat ? 700 : 500,
                  transition: 'all 0.2s',
                }}
              >
                {cat === 'ALL' ? 'Todos' : cat}
              </button>
            ))}
          </div>

          {/* Article Cards */}
          <nav aria-label="Índice de artículos" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '72vh', overflowY: 'auto' }}>
            {filteredArticles.map((art) => {
              const isSelected = art.id === currentArticle.id;
              return (
                <div
                  key={art.id}
                  role="button"
                  tabIndex={0}
                  aria-current={isSelected ? 'true' : undefined}
                  onClick={() => setSelectedArticleId(art.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedArticleId(art.id);
                    }
                  }}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: isSelected
                      ? 'rgba(59, 130, 246, 0.14)'
                      : 'var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span aria-hidden="true">{art.icon}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: isSelected ? 'var(--text-bright)' : 'var(--text-primary)' }}>
                        {art.title}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                    {art.summary}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{art.category}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>⏱️ {art.readTime}</span>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Right: Article Reader */}
        <Card variant="glass" as="article" style={{ padding: '28px', minHeight: '600px' }}>
          {/* Article Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '2rem' }}>{currentArticle.icon}</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-bright)' }}>
                  {currentArticle.title}
                </h2>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <Badge variant="mint">{currentArticle.category}</Badge>
                  <Badge variant="lavender">⏱️ Lectura: {currentArticle.readTime}</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Widget if present */}
          {currentArticle.hasInteractiveWidget === 'EXO_CALCULATOR' && (
            <InteractiveExoWidget />
          )}

          {/* Markdown-style Content Body */}
          <div
            style={{
              marginTop: '20px',
              fontSize: '0.875rem',
              lineHeight: 1.7,
              color: 'var(--text-primary)',
            }}
          >
            {currentArticle.content.split('\n\n').map((block, idx) => {
              const trimmed = block.trim();
              if (trimmed.startsWith('# ')) {
                return (
                  <h1 key={idx} style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-bright)', marginTop: '24px', marginBottom: '8px' }}>
                    {trimmed.replace('# ', '')}
                  </h1>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h2 key={idx} style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-bright)', marginTop: '20px', marginBottom: '6px' }}>
                    {trimmed.replace('## ', '')}
                  </h2>
                );
              }
              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={idx} style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-sakura)', marginTop: '16px', marginBottom: '4px' }}>
                    {trimmed.replace('### ', '')}
                  </h3>
                );
              }
              if (trimmed.startsWith('> ')) {
                return (
                  <div
                    key={idx}
                    style={{
                      margin: '14px 0',
                      padding: '10px 14px',
                      backgroundColor: 'rgba(0, 229, 255, 0.08)',
                      borderLeft: '3px solid #00E5FF',
                      borderRadius: '0 6px 6px 0',
                      fontSize: '0.82rem',
                      color: 'var(--text-bright)',
                    }}
                  >
                    {trimmed.replace('> ', '')}
                  </div>
                );
              }
              if (trimmed.startsWith('- ')) {
                const items = trimmed.split('\n');
                return (
                  <ul key={idx} style={{ margin: '8px 0 14px 20px', padding: 0 }}>
                    {items.map((it, iIdx) => (
                      <li key={iIdx} style={{ marginBottom: '4px' }}>
                        {it.replace(/^- /, '')}
                      </li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={idx} style={{ margin: '0 0 14px' }}>
                  {trimmed}
                </p>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
