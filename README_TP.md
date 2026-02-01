# Cómo ejecutar el programa

### Configuración inicial
1. Copiar el archivo de variables de entorno:
```bash
cp .env.example .env
```

2. Editar el archivo `.env` y configurar las variables necesarias:
   - **Configuración SMTP** (para notificaciones por correo):
     - `SMTP_HOST`: Servidor SMTP (ej: smtp.gmail.com)
     - `SMTP_PORT`: Puerto SMTP (generalmente 587)
     - `SMTP_USERNAME`: Tu correo electrónico
     - `SMTP_PASSWORD`: Contraseña de aplicación (para Gmail, generarla en https://myaccount.google.com/apppasswords)
     - `SMTP_FROM_EMAIL`: Correo desde el que se enviarán las notificaciones
     - `SMTP_USE_TLS`: true (recomendado)
   - `LOCATIONIQ_API_KEY`: Tu API key de LocationIQ
   - **Asistente IA (OpenAI u otro endpoint compatible)**:
     - `OPENAI_API_KEY`: Tu API key de OpenAI (opcional pero necesaria para el chatbot en producción).
     - `OPENAI_MODEL`: Modelo a usar (por defecto `gpt-4o-mini`; si usás Ollama, poné el nombre del modelo disponible).
     - `OPENAI_BASE_URL`: Dejalo vacío en deploy para usar la API pública de OpenAI. Solo completalo si tenés un endpoint accesible (ej: `http://host.docker.internal:11434/v1` o un reverse proxy).
     - `OPENAI_ALLOW_LOCALHOST`: Ponelo en `true` solo si realmente querés usar una URL `localhost/127.0.0.1` desde un contenedor (por ejemplo, con Ollama en la misma red).

### Levantar servicios (Postgres y MongoDB)
```bash
cd infra
docker compose up -d db mongo
```

### Iniciar entorno virtual
```bash
cd backend
/usr/bin/python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Creación de tablas (solo luego de destruir el volumen anterior)
```bash
cd backend
python3 create_db_tables.py
```

## Aplicar migraciones (solo luego de destruir el volumen anterior)
```bash
cd backend
python3 -m migrations.0001_add_review_author_fk
python3 -m migrations.0002_add_user_photo_file_id
python3 -m migrations.0003_add_place_photo_file_id
python3 -m migrations.0004_add_review_photo_file_id
python3 -m migrations.0005_add_review_reply_fields
python3 -m migrations.0006_add_challenge_tracking
python3 -m migrations.0007_add_reward_types
python3 -m migrations.0008_add_place_id_to_user_rewards
```

### Ejecutar Backend
```bash
cd backend
source .venv/bin/activate
python3 insert_initial_rewards.py
uvicorn main:app --reload --port 8000
```

### Ejecutar Frontend (en otra terminal)
```bash
cd frontend
npm install 
npm run dev
```

Para acceder al frontend utilizar: http://localhost:5173

## Funcionalidades de Notificaciones

El sistema incluye notificaciones por correo electrónico para:

1. **Notificaciones de Reseñas**: Los propietarios reciben un email cuando alguien hace una reseña en sus publicaciones.
2. **Notificaciones de Recompensas**: Los usuarios reciben un email cuando reclaman exitosamente una recompensa.

**Nota**: Las notificaciones requieren configurar correctamente las variables SMTP en el archivo `.env`. Si no se configuran, el sistema funcionará normalmente pero no enviará correos.


## Ejecución con Docker (Deploy)

### Levantar toda la aplicación
```bash
cd infra
docker compose up --build -d
```

### Creación de tablas y migraciones (solo la primera vez)
```bash
docker compose exec api python create_db_tables.py
docker compose exec api python -m migrations.0001_add_review_author_fk
docker compose exec api python -m migrations.0002_add_user_photo_file_id
docker compose exec api python -m migrations.0003_add_place_photo_file_id
docker compose exec api python -m migrations.0004_add_review_photo_file_id
docker compose exec api python -m migrations.0005_add_review_reply_fields
docker compose exec api python -m migrations.0006_add_challenge_tracking
docker compose exec api python -m migrations.0007_add_reward_types
docker compose exec api python -m migrations.0008_add_place_id_to_user_rewards
docker compose exec api python insert_initial_rewards.py
```

Para acceder al frontend utilizar: https://frontend-production-a7ea.up.railway.app/ 

Nota: para que el chatbot funcione en deploy, dejá `OPENAI_BASE_URL` vacío o apuntá a un endpoint accesible desde el contenedor (la URL `127.0.0.1:11434` solo sirve en desarrollo local con Ollama).
