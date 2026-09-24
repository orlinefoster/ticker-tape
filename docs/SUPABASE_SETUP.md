# Configuración de Supabase Cloud para Centralización y Caché ☁️

Esta guía detalla cómo conectar tu proyecto en **Supabase** para centralizar datos, respaldar snapshots diarios y minimizar consultas a APIs externas (Yahoo Finance / Binance / IOL).

---

## 1. Crear el Proyecto en Supabase (Gratuito)

1. Ingresa a [supabase.com](https://supabase.com/) e inicia sesión.
2. Crea una nueva organización y un nuevo proyecto llamado `ticker-tape-hub`.
3. Selecciona la región más cercana (ej. `sa-east-1 São Paulo` o `us-east-1 North Virginia`).

---

## 2. Aplicar el Esquema SQL

1. En el panel izquierdo de tu proyecto Supabase, ingresa a **SQL Editor**.
2. Abre el archivo [`supabase/schema.sql`](file:///C:/Users/gabriela.fozzatti/Documents/develops/ticker-tape/supabase/schema.sql) de este repositorio.
3. Copia su contenido, pégalo en el editor SQL de Supabase y haz clic en **Run**.
4. Esto creará las 5 tablas maestras:
   - `market_candles`: Caché compartida de velas históricas.
   - `portfolio_snapshots`: Cierres diarios de patrimonio total en USD y ARS.
   - `portfolios`: Definición de carteras (Cash, IOL, Binance).
   - `positions`: Tenencias consolidadas.
   - `transactions`: Asientos contables auditables.

---

## 3. Conectar Ticker Tape con Supabase

1. En el panel de Supabase, ve a **Project Settings > API**.
2. Copia los dos valores:
   - **Project URL:** `https://xyzcompany.supabase.co`
   - **anon / public key:** `eyJhbGciOi...`
3. Abre **Ticker Tape** y navega a **Proveedores & Sync** (`/providers`).
4. Pega la URL y la Anon Key en el panel inferior **☁️ Configuración de Conexión a Supabase Cloud**.
5. Haz clic en **Guardar Configuración** y luego en **☁️ Ping Supabase Cloud**.
6. Una vez conectado, las velas de mercado se consultarán automáticamente desde Supabase Cloud para no agotar cuotas externas.
