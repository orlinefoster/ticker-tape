import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'glass' | 'glow-sakura' | 'glow-mint' | 'glow-lavender' | 'holo' | 'holo-border' | 'filled';
  as?: React.ElementType;
  children: React.ReactNode;
}

export interface CardSubComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

const CardRoot: React.FC<CardProps> = ({
  variant = 'default',
  as: Component = 'div',
  children,
  style,
  className = '',
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'filled':
        return {
          background: 'var(--border)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        };
      case 'primary':
        return {
          background: 'var(--bg-surface-card)',
          border: '1px solid var(--accent)',
          boxShadow: 'var(--shadow-card)',
        };
      case 'holo':
        return {
          background: 'linear-gradient(135deg, var(--bg-surface-card) 0%, rgba(25, 29, 50, 0.9) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.28)',
          boxShadow: 'var(--shadow-card)',
          backgroundImage: 'var(--holo-gradient-subtle)',
          backgroundSize: '200% 200%',
        };
      case 'holo-border':
        return {
          background: 'var(--bg-surface-card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        };
      case 'glass':
        return {
          background: 'var(--bg-surface-glass)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border-subtle)',
        };
      case 'glow-sakura':
        return {
          background: 'var(--bg-surface-card)',
          border: '1px solid var(--accent)',
          boxShadow: '0 0 16px var(--accent-glow)',
        };
      case 'glow-mint':
        return {
          background: 'var(--bg-surface-card)',
          border: '1px solid var(--border-mint)',
          boxShadow: '0 0 16px rgba(16, 185, 129, 0.2)',
        };
      case 'glow-lavender':
        return {
          background: 'var(--bg-surface-card)',
          border: '1px solid rgba(129, 140, 248, 0.3)',
          boxShadow: '0 0 16px rgba(129, 140, 248, 0.2)',
        };
      case 'default':
      default:
        return {
          background: 'var(--bg-surface-card)',
          border: '1px solid var(--border-subtle)',
        };
    }
  };

  return (
    <Component
      className={`cyber-card ${className}`}
      style={{
        borderRadius: 'var(--radius)',
        padding: '16px',
        boxShadow: 'var(--shadow-card)',
        transition: 'border-color var(--transition-fast)',
        ...getVariantStyles(),
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
};

const CardHeader: React.FC<CardSubComponentProps> = ({ children, style, ...props }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: '12px',
      marginBottom: '12px',
      borderBottom: '1px solid var(--border-subtle)',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

const CardTitle: React.FC<CardTitleProps> = ({ children, as: Tag = 'h3', style, ...props }) => (
  <Tag
    style={{
      margin: 0,
      fontSize: '0.95rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      color: 'var(--text-bright)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      ...style,
    }}
    {...props}
  >
    {children}
  </Tag>
);

const CardDescription: React.FC<CardSubComponentProps> = ({ children, style, ...props }) => (
  <p
    style={{
      margin: '4px 0 0',
      fontSize: '0.78rem',
      color: 'var(--text-muted)',
      lineHeight: 1.4,
      ...style,
    }}
    {...props}
  >
    {children}
  </p>
);

const CardContent: React.FC<CardSubComponentProps> = ({ children, style, ...props }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...style }} {...props}>
    {children}
  </div>
);

const CardFooter: React.FC<CardSubComponentProps> = ({ children, style, ...props }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '8px',
      paddingTop: '12px',
      marginTop: '12px',
      borderTop: '1px solid var(--border-subtle)',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Content: CardContent,
  Footer: CardFooter,
});

