# 🚀 PLANOS PRO - Configuración e Instalación

## ✅ Estructura Implementada

Se ha creado la estructura completa del proyecto según la guía de implementación:

### 📁 Estructura de Archivos Creada

```
planos_pro/
├── .env.local                              ✅ Variables de entorno
├── prisma/
│   └── schema.prisma                       ✅ Esquema de base de datos
├── types/
│   ├── planos.ts                           ✅ Tipos de planos
│   ├── api.ts                              ✅ Tipos de API
│   └── database.ts                         ✅ Tipos de base de datos
├── lib/
│   ├── db/
│   │   └── client.ts                       ✅ Cliente Prisma
│   ├── auth/
│   │   └── api-keys.ts                     ✅ Sistema de API keys
│   ├── queue/
│   │   ├── client.ts                       ✅ Cliente BullMQ
│   │   └── jobs.ts                         ✅ Definición de jobs
│   ├── validators/
│   │   ├── schemas.ts                      ✅ Esquemas Zod base
│   │   └── apiSchemas.ts                   ✅ Esquemas de API
│   ├── geometry/
│   │   ├── utmUtils.ts                     ✅ Utilidades UTM
│   │   ├── scaleUtils.ts                   ✅ Utilidades de escala
│   │   └── cadDrawing.ts                   ✅ Primitivas CAD
│   ├── generators/
│   │   ├── PlanoGenerator.ts               ✅ Orquestador principal
│   │   ├── MemoriaDescriptiva.ts           ✅ Generador memoria
│   │   ├── PlanoPerimetrico.ts             ✅ Generador plano
│   │   └── PlanoUbicacion.ts               ✅ Generador ubicación
│   └── utils/
│       └── env.ts                          ✅ Validación variables entorno
└── app/
    └── api/
        └── v1/
            ├── health/route.ts             ✅ Health check
            ├── planos/
            │   ├── generar/route.ts        ✅ POST - Generar plano
            │   ├── [id]/route.ts           ✅ GET - Obtener plano
            │   └── lista/route.ts          ✅ GET - Listar planos
```

## 🔧 Próximos Pasos

### 1. Instalar Dependencias

```bash
# Dependencias de producción
npm install @prisma/client zod @t3-oss/env-nextjs
npm install bullmq ioredis
npm install jspdf canvas sharp
npm install proj4 @turf/turf
npm install nanoid bcryptjs
npm install @vercel/blob
npm install date-fns numeral clsx tailwind-merge

# Dependencias de desarrollo
npm install -D prisma
npm install -D @types/bcryptjs @types/proj4 @types/numeral
npm install -D tsx

# Generar cliente Prisma
npx prisma generate
```

### 2. Configurar Base de Datos

**Opción A: PostgreSQL Local**
```bash
# Instalar PostgreSQL
# Actualizar DATABASE_URL en .env.local
DATABASE_URL="postgresql://user:password@localhost:5432/planos_pro"

# Ejecutar migraciones
npx prisma migrate dev --name init
```

**Opción B: Supabase/Neon (Cloud)**
```bash
# Crear cuenta en Supabase o Neon
# Copiar DATABASE_URL desde el dashboard
# Actualizar .env.local

# Ejecutar migraciones
npx prisma migrate dev --name init
```

### 3. Configurar Redis

**Opción A: Redis Local**
```bash
# Instalar Redis
# Windows: usar WSL o descargar binarios
# Mac: brew install redis
# Linux: apt-get install redis-server

# Actualizar REDIS_URL en .env.local
REDIS_URL="redis://localhost:6379"
```

**Opción B: Upstash (Cloud)**
```bash
# Crear cuenta en upstash.com
# Crear base de datos Redis
# Copiar REDIS_URL desde dashboard
# Actualizar .env.local
```

### 4. Actualizar Variables de Entorno

Editar `.env.local` con tus valores reales:

```env
# Base de datos (REQUERIDO)
DATABASE_URL="postgresql://..."

# Redis (REQUERIDO)
REDIS_URL="redis://..."

# JWT Secret (GENERAR UNO NUEVO)
JWT_SECRET="$(openssl rand -base64 32)"

# Storage (elegir uno)
STORAGE_TYPE="vercel-blob"
BLOB_READ_WRITE_TOKEN="tu-token-vercel"
```

### 5. Verificar Instalación

```bash
# Ejecutar desarrollo
npm run dev

# Verificar health check
curl http://localhost:3000/api/v1/health

# Abrir Prisma Studio
npm run db:studio
```

## 📝 Tareas Pendientes

### Fase 1: Setup Básico
- [ ] Instalar todas las dependencias
- [ ] Configurar base de datos PostgreSQL
- [ ] Configurar Redis
- [ ] Ejecutar migraciones Prisma
- [ ] Actualizar variables de entorno
- [ ] Verificar que `npm run dev` funciona

### Fase 2: Base de Datos
- [ ] Crear usuario administrador inicial
- [ ] Generar primera API key de prueba
- [ ] Probar conexión a base de datos

### Fase 3: Testing de API
- [ ] Probar endpoint `/api/v1/health`
- [ ] Probar generación de plano simple
- [ ] Verificar sistema de colas

### Fase 4: Implementación Adicional
- [ ] Crear workers para procesamiento de planos
- [ ] Implementar storage de archivos (S3/Vercel Blob)
- [ ] Crear dashboard web
- [ ] Implementar editor visual
- [ ] Agregar tests unitarios

## 🔍 Comandos Útiles

```bash
# Desarrollo
npm run dev              # Iniciar servidor de desarrollo

# Base de datos
npm run db:push          # Push schema a DB (desarrollo)
npm run db:migrate       # Crear migración
npm run db:studio        # Abrir Prisma Studio

# Workers
npm run worker:dev       # Ejecutar worker de generación

# Producción
npm run build            # Build para producción
npm start                # Iniciar en producción

# Testing
npm test                 # Ejecutar tests
npm run type-check       # Verificar tipos TypeScript
```

## 📚 Documentación de Referencia

- **Guía Completa**: [`plans/GUIA_IMPLEMENTACION_PLANOS_PRO.md`](plans/GUIA_IMPLEMENTACION_PLANOS_PRO.md)
- **Arquitectura**: [`plans/ARQUITECTURA_MICROSERVICIO_PLANOS.md`](plans/ARQUITECTURA_MICROSERVICIO_PLANOS.md)
- **Análisis**: [`plans/ANALISIS_CRITICO_APLICACION_INDEPENDIENTE.md`](plans/ANALISIS_CRITICO_APLICACION_INDEPENDIENTE.md)

## ⚠️ Notas Importantes

1. **Los errores de TypeScript son normales** hasta que instales las dependencias con `npm install`
2. **Actualiza el JWT_SECRET** antes de pasar a producción
3. **Configura el storage** antes de generar planos (Vercel Blob o S3)
4. **Redis es necesario** para el sistema de colas
5. **PostgreSQL es necesario** para la base de datos

## 🆘 Solución de Problemas

### Error: Cannot find module '@prisma/client'
```bash
npm install @prisma/client
npx prisma generate
```

### Error: Cannot connect to database
```bash
# Verificar que PostgreSQL está corriendo
# Verificar DATABASE_URL en .env.local
npx prisma migrate dev
```

### Error: Cannot connect to Redis
```bash
# Verificar que Redis está corriendo
# Verificar REDIS_URL en .env.local
```

## 📞 Siguiente Paso

Ejecuta en orden:

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar base de datos
npx prisma migrate dev --name init

# 3. Iniciar desarrollo
npm run dev
```

---

**Estado**: ✅ Estructura base completada  
**Próximo**: Instalar dependencias y configurar servicios  
**Fecha**: 2026-01-24
