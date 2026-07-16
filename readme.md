# Cúmulo IA

Asistente conversacional del grupo de astronomía Cúmulo: lector de conocimiento (RAG) con Gemini API, generación de documentos, modo de voz en vivo **y conexión con WhatsApp**. Construido con React + Vite + Express y publicado en GitHub Pages + Render.

| Servicio | URL | Para qué |
|----------|-----|----------|
| **Sitio Web** | https://juslozanoma.github.io/cumulo/ | Interfaz de chat web |
| **API + WhatsApp** | https://cumulo-x2ia.onrender.com | Backend, webhook y API |
| **Evolution API** | https://evolution-api-5q3w.onrender.com | Conexión con WhatsApp |

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO                                │
│  ┌──────────────┐                    ┌─────────────────────┐  │
│  │ Navegador    │                    │ WhatsApp (celular)  │  │
│  │ Chat web     │                    │ Mensaje a Cúmulo    │  │
│  └──────┬───────┘                    └──────────┬──────────┘  │
│         │                                       │              │
│         ▼                                       ▼              │
│  ┌──────────────┐                    ┌─────────────────────┐  │
│  │ GitHub Pages │                    │ Evolution API       │  │
│  │ (frontend)   │                    │ (WhatsApp ↔ API)    │  │
│  └──────────────┘                    └──────────┬──────────┘  │
│                                                 │              │
│                                                 ▼              │
│                                        ┌─────────────────────┐ │
│                                        │ Render: Cúmulo API  │ │
│                                        │ /webhook (WhatsApp) │ │
│                                        │ /api/chat (web)     │ │
│                                        │ / (frontend)        │ │
│                                        └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Primeros pasos (solo la primera vez)

```bash
git clone https://github.com/juslozanoma/cumulo.git
cd cumulo
npm install
```

Esto descarga el proyecto y todas sus dependencias.

---

## 🧑‍💻 Trabajar en el proyecto (día a día)

### Frontend (interfaz web)
```bash
npm run dev
```
Abre `http://localhost:5173/` en el navegador. Edita archivos en `src/`. Vite recarga automáticamente.

### Backend (API + WhatsApp)
```bash
npm start
```
Inicia el servidor en `http://localhost:3000` con:
- API de chat: `POST /api/chat`
- Webhook de WhatsApp: `POST /webhook`
- Frontend (producción): `GET /`

---

## 💾 Guardar código en GitHub (rama `main`)

```bash
git add .
git commit -m "Descripción de los cambios"
git push origin main
```

> ⚠️ Esto **no** actualiza el sitio publicado ni el backend. Solo guarda el código.

---

## 🌐 Publicar el sitio web (GitHub Pages)

El sitio público vive en la rama `gh-pages`:

```bash
npm run build
npm run deploy
```

- `build` genera `dist/` con la versión optimizada.
- `deploy` sube `dist/` a la rama `gh-pages`.

---

## ☁️ Publicar el backend (Render)

Render detecta automáticamente los cambios en `main` si tienes **Auto-Deploy** activado.

Si no, ve a Render Dashboard → tu servicio `cumulo` → **Manual Deploy** → **Deploy latest commit**.

---

## ⚡ Publicar todo en un solo paso

```bash
npm run publish -- "Descripción de los cambios"
```

Este comando:
1. Compila el frontend (`build`)
2. Publica en GitHub Pages (`deploy`)
3. Guarda y sube código a `main` (`git add` + `git commit` + `git push`)
4. Render se actualiza automáticamente (si Auto-Deploy está activo)

---

## 📁 Estructura del proyecto

```
cumulo/
├── package.json              # Dependencias y scripts
├── vite.config.js            # Configuración de Vite
├── server.js                 # Backend: API + WhatsApp webhook
├── index.html                # Punto de entrada HTML (Vite)
├── .env                      # Variables locales (NO subir)
├── .gitignore                # Archivos ignorados por Git
├── embeddings.json           # Embeddings generados (NO subir)
├── kb.json                   # Base de conocimiento
├── kb-metadata.json          # Metadatos de la base
├── procesar_v2.py            # Script para procesar documentos
├── public/
│   ├── icon.png
│   └── kb.json               # Copia accesible desde el frontend
└── src/                      # Código React
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── components/
    ├── hooks/
    └── utils/
```

---

## 🔑 Variables de entorno

Crea un archivo `.env` en la raíz (NO lo subas a GitHub):

```
GEMINI_API_KEY=tu-api-key-de-google-ai-studio
```

En Render, configura estas variables:
- `GEMINI_API_KEY`
- `NODE_ENV=production`

---

## 🤖 Cómo funciona el RAG (Retrieval Augmented Generation)

1. **Procesamiento:** `kb.json` se divide en chunks de ~2000 caracteres
2. **Embeddings:** Cada chunk se convierte en un vector numérico con Gemini
3. **Almacenamiento:** Se guardan en `embeddings.json`
4. **Consulta:** Cuando llega una pregunta, se buscan los 3 chunks más similares
5. **Respuesta:** Solo esos chunks se envían a Gemini, no todo el archivo

Esto evita exceder la cuota de tokens (límite gratuito: 250K/min).

---

## 📱 WhatsApp Integration

| Componente | Descripción |
|------------|-------------|
| **Evolution API** | Servicio que conecta con WhatsApp vía Baileys |
| **Webhook** | `POST /webhook` recibe mensajes de WhatsApp |
| **Respuesta** | Tu bot consulta Gemini y responde automáticamente |

### Configuración en Evolution API Manager
1. Ve a `https://evolution-api-5q3w.onrender.com/manager`
2. Crea instancia con **Baileys**
3. Escanea QR con WhatsApp Business
4. Configura webhook: `https://cumulo-x2ia.onrender.com/webhook`
5. Activa evento **MESSAGES_UPSERT**

---

## 🛠️ Solución de problemas comunes

| Problema | Solución |
|----------|----------|
| **La página aparece en blanco en GitHub Pages** | Revisa `base: '/cumulo/'` en `vite.config.js` |
| **Error `EJSONPARSE` en `package.json`** | Falta una coma en `"scripts"`. Revisa la línea del error |
| **WhatsApp no responde** | Verifica que Evolution API esté `Connected` y el webhook activo |
| **Error `429 Too Many Requests` (Gemini)** | `kb.json` es muy grande. Reduce o usa embeddings |
| **Embeddings tardan mucho** | Normal en primera ejecución. Se guardan en `embeddings.json` |
| **`embeddings.json` no existe** | Ejecuta `npm start` y espera a que termine la generación |
| **Error `API key not valid`** | Verifica `GEMINI_API_KEY` en `.env` y en Render |

---

## 🔄 Flujo típico de trabajo

```bash
# 1. Desarrollar
npm run dev          # Frontend en localhost:5173
npm start            # Backend en localhost:3000 (en otra terminal)

# 2. Actualizar conocimiento
# Edita kb.json o documentos/ → ejecuta procesar_v2.py → borra embeddings.json

# 3. Publicar todo
npm run publish -- "Descripción de los cambios"
```

---

## 📚 Recursos externos

| Servicio | URL | Para qué |
|----------|-----|----------|
| Render Dashboard | https://dashboard.render.com | Deploy del backend |
| Google AI Studio | https://aistudio.google.com/app/apikey | API key de Gemini |
| Evolution API Docs | https://doc.evolution-api.com/v2/en/get-started/introduction | Documentación de WhatsApp |
| Redis Cloud | https://redis.io/try-free/ | Base de datos en memoria (sesiones) |
