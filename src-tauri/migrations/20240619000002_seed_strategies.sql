-- Seed strategies for Ticker Tape trading system

INSERT OR IGNORE INTO strategies (id, name, description, config) VALUES
('ma-crossover', 'MA Crossover', 'Moving Average crossover strategy', '{"fast":50,"slow":200}'),
('bollinger-bands', 'Bollinger Bands', 'Mean reversion with Bollinger Bands', '{"period":20,"stddev":2.0}'),
('rsi', 'RSI', 'Relative Strength Index strategy', '{"period":14,"overbought":70,"oversold":30}');
