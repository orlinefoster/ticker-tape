export interface WikiArticle {
  id: string;
  title: string;
  category: 'Administración de Cartera' | 'Gestión del Riesgo' | 'Modelos Cuantitativos' | 'Estructura de Mercado';
  icon: string;
  readTime: string;
  summary: string;
  content: string;
  hasInteractiveWidget?: 'EXO_CALCULATOR' | 'VWAP_CALCULATOR';
}
