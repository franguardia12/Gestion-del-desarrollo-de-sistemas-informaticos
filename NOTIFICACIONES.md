# Documentación de Notificaciones por Correo Electrónico

## Resumen

Este documento describe la implementación de las dos historias de usuario relacionadas con notificaciones por correo electrónico.

## Historias de Usuario Implementadas

### Historia 1: Notificación de Reseñas a Propietarios

**Descripción**: Los propietarios son notificados cuando alguien comenta sus publicaciones.

**Como**: Propietario  
**Quiero**: Recibir notificaciones por correo registrado en la página cuando alguien hace una reseña de mis publicaciones  
**Para**: Enterarme que me han comentado

**Criterios de Aceptación**:
- ✅ Cuando otro usuario hace una reseña de una publicación, se le notifica al usuario propietario de la publicación por el correo registrado en la página.

**Implementación**:
- Archivo: `backend/routers/reviews.py`
- Función: `create_review()`
- Se envía email al propietario del lugar después de crear exitosamente una reseña
- El email incluye:
  - Nombre del lugar
  - Nombre del autor de la reseña
  - Calificación (estrellas)
  - Título de la reseña
  - Versión HTML con formato atractivo

### Historia 2: Notificación de Recompensas a Usuarios

**Descripción**: Los usuarios son notificados por el correo registrado en la página al obtener recompensa exitosa.

**Como**: Usuario  
**Quiero**: Recibir notificaciones cuando se me ha dado una recompensa  
**Para**: Poder hacer uso de ella

**Criterios de Aceptación**:
- ✅ Cuando se ha transferido una recompensa (cuando el usuario ha hecho click en "reclamar" y de manera efectiva se ha entregado la recompensa), el usuario es notificado por el correo registrado en la página diciendo el título de la recompensa entregada.

**Implementación**:
- Archivo: `backend/routers/rewards.py`
- Función: `claim_reward()`
- Se envía email al usuario después de reclamar exitosamente una recompensa
- El email incluye:
  - Título de la recompensa
  - Descripción de la recompensa
  - Mensaje de felicitación
  - Versión HTML con formato celebratorio

### Historia 3: Notificación de Recompensas Disponibles

**Descripción**: Los usuarios son notificados cuando una recompensa está disponible para ser reclamada.

**Como**: Usuario  
**Quiero**: Recibir notificaciones cuando completo un desafío y una recompensa está disponible para reclamar  
**Para**: Estar enterado inmediatamente de mis logros y poder reclamar mi recompensa

**Criterios de Aceptación**:
- ✅ Cuando un usuario completa un desafío (antes de hacer click en "reclamar"), se le notifica por correo electrónico que tiene una recompensa disponible.
- ✅ La notificación se envía automáticamente cuando el desafío cambia de estado incompleto a completado.
- ✅ El correo incluye información sobre el desafío completado y la recompensa disponible.

**Implementación**:
- Archivos modificados:
  - `backend/services/challenge_service.py`
  - `backend/services/email_service.py`
- Función principal: `check_and_update_user_challenges()`
- Función helper: `_send_reward_available_notifications()`
- Nueva función de email: `send_reward_available_notification()`
- El email incluye:
  - Nombre del usuario
  - Título del desafío completado
  - Título de la recompensa disponible
  - Descripción de la recompensa
  - Mensaje motivacional
  - Versión HTML con formato atractivo en color verde

## Componentes Implementados

### 1. Servicio de Email (`backend/services/email_service.py`)

Servicio centralizado para el envío de correos electrónicos usando SMTP.

**Características**:
- Clase `EmailService` que maneja toda la lógica de envío de correos
- Soporte para texto plano y HTML
- Métodos especializados:
  - `send_review_notification()`: Notificación de reseñas a propietarios
  - `send_reward_notification()`: Notificación de recompensas reclamadas
  - `send_reward_available_notification()`: Notificación de recompensas disponibles
- Manejo de errores robusto
- Configuración mediante variables de entorno

### 2. Configuración (`backend/settings.py`)

Se agregaron las siguientes variables de configuración SMTP:
- `SMTP_HOST`: Servidor SMTP
- `SMTP_PORT`: Puerto SMTP (default: 587)
- `SMTP_USERNAME`: Usuario para autenticación
- `SMTP_PASSWORD`: Contraseña para autenticación
- `SMTP_FROM_EMAIL`: Correo electrónico del remitente
- `SMTP_USE_TLS`: Usar TLS para la conexión (default: true)

### 3. Variables de Entorno (`.env.example`)

Se documentó la configuración SMTP necesaria con ejemplo para Gmail.

### 4. Actualización de Routers

#### `backend/routers/reviews.py`
- Se importa el servicio de email
- Se envía notificación al propietario después de crear una reseña
- Manejo de errores: si el email falla, no afecta la creación de la reseña

#### `backend/routers/rewards.py`
- Se importa el servicio de email
- Se envía notificación al usuario después de reclamar una recompensa
- Manejo de errores: si el email falla, no afecta el reclamo de la recompensa

### 5. Script de Prueba (`backend/test_email_service.py`)

Script para verificar el funcionamiento del servicio de notificaciones:
- Verifica la configuración SMTP
- Prueba el envío de notificación de reseña
- Prueba el envío de notificación de recompensa
- Proporciona instrucciones de configuración si no está habilitado

**Uso**:
```bash
cd backend
source .venv/bin/activate
python test_email_service.py
```

## Configuración del Servicio

### Para Gmail

1. Habilitar "Verificación en 2 pasos" en tu cuenta de Google
2. Generar una "Contraseña de aplicación" en: https://myaccount.google.com/apppasswords
3. Configurar las variables en `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=tu_correo@gmail.com
SMTP_PASSWORD=tu_contraseña_de_aplicacion_generada
SMTP_FROM_EMAIL=tu_correo@gmail.com
SMTP_USE_TLS=true
```

### Para otros proveedores

Consulta la documentación de tu proveedor de correo para obtener:
- Host SMTP
- Puerto SMTP
- Configuración de autenticación

Proveedores comunes:
- **Gmail**: smtp.gmail.com:587
- **Outlook/Hotmail**: smtp-mail.outlook.com:587
- **Yahoo**: smtp.mail.yahoo.com:587
- **SendGrid**: smtp.sendgrid.net:587

## Flujo de Notificaciones

### Notificación de Reseña

1. Usuario crea una reseña en una publicación
2. Se guarda la reseña en la base de datos
3. Se actualizan los desafíos correspondientes
4. Se obtienen los datos del propietario del lugar
5. Se envía el correo electrónico al propietario
6. Si el envío falla, se registra en los logs pero no se interrumpe el flujo

### Notificación de Recompensa Disponible (Nueva)

1. Usuario realiza una acción (crear reseña, votar, etc.)
2. El sistema recalcula el progreso de todos los desafíos del usuario
3. Se detecta que un desafío ha pasado de incompleto a completado
4. Se busca la recompensa asociada al desafío completado
5. Se envía correo electrónico automáticamente al usuario
6. El usuario es notificado que tiene una recompensa disponible para reclamar
7. Si el envío falla, se registra en los logs pero no se interrumpe el flujo

### Notificación de Recompensa Reclamada

1. Usuario reclama una recompensa (después de completar el desafío)
2. Se crea el registro UserReward en la base de datos
3. Se confirma el commit de la transacción
4. Se envía el correo electrónico al usuario
5. Si el envío falla, se registra en los logs pero no se interrumpe el flujo

## Características de Seguridad

- Las contraseñas SMTP no se guardan en el código
- Uso de variables de entorno para configuración sensible
- Soporte para TLS/SSL
- Manejo de errores sin exponer información sensible

## Manejo de Errores

- Si la configuración SMTP no está completa, el servicio se desactiva silenciosamente
- Los errores de envío se registran en logs con nivel WARNING
- Los errores de email no interrumpen las operaciones principales (crear reseña, reclamar recompensa)
- Los usuarios reciben respuestas de éxito aunque el email falle

## Formato de Correos

### Email de Reseña
- **Asunto**: "Nueva reseña en tu publicación: [Nombre del Lugar]"
- **Contenido**:
  - Saludo personalizado
  - Nombre del lugar
  - Nombre del autor de la reseña
  - Calificación con estrellas visuales
  - Título de la reseña
  - Llamado a la acción para ver la reseña completa
  - Footer con nota de correo automático

### Email de Recompensa Disponible (Nueva)
- **Asunto**: "¡Recompensa Disponible! - [Título de la Recompensa]"
- **Estilo**: Verde (#4CAF50) - Representa disponibilidad y logro
- **Contenido**:
  - Saludo personalizado con emojis celebratorios (🎉 ✨)
  - Mensaje de felicitación por completar el desafío
  - Nombre del desafío completado
  - Título de la recompensa disponible
  - Descripción de la recompensa
  - Llamado a la acción para ingresar a la plataforma y reclamar
  - Motivación para seguir completando desafíos
  - Footer con nota de correo automático

### Email de Recompensa Reclamada
- **Asunto**: "¡Recompensa reclamada exitosamente! - [Título de la Recompensa]"
- **Estilo**: Naranja (#FF9800) - Representa éxito y recompensa obtenida
- **Contenido**:
  - Saludo personalizado con emojis celebratorios (🎉 🏆)
  - Título de la recompensa
  - Descripción de la recompensa
  - Confirmación de que ya puede usar la recompensa
  - Motivación para seguir completando desafíos
  - Footer con nota de correo automático

## Testing

Para probar las notificaciones:

1. Configurar las variables SMTP en `.env`
2. Ejecutar el script de prueba:
   ```bash
   python backend/test_email_service.py
   ```
3. Verificar que los correos de prueba se reciban correctamente

## Integración End-to-End

### Probar Notificación de Reseña

1. Crear un usuario propietario con un email válido
2. Crear un lugar asociado a ese propietario
3. Crear otro usuario (revisor)
4. Iniciar sesión como el revisor
5. Crear una reseña en el lugar del propietario
6. Verificar que el propietario reciba el email

### Probar Notificación de Recompensa Disponible (Nueva)

1. Crear un usuario con email válido
2. Realizar acciones para completar un desafío (por ejemplo, crear reseñas)
3. El sistema detecta automáticamente el desafío completado
4. **Verificar que el usuario reciba el email de recompensa disponible**
5. Luego el usuario puede ingresar a la plataforma y reclamar la recompensa

### Probar Notificación de Recompensa Reclamada

1. Crear un usuario con email válido
2. Completar un desafío (el usuario recibirá el email de recompensa disponible)
3. Verificar que el desafío se marque como completado
4. Reclamar la recompensa asociada al desafío
5. **Verificar que el usuario reciba el email de recompensa reclamada**

## Notas de Implementación

- Las notificaciones se envían de forma **síncrona** (no en background)
- El tiempo de envío es típicamente < 1 segundo con buena conexión
- Para volúmenes altos, considerar implementar una cola de mensajes (ej: Celery)
- Los emails se envían inmediatamente después de confirmar la transacción en DB

### Diferencias entre las Notificaciones de Recompensa

El sistema ahora implementa **dos tipos de notificaciones** relacionadas con recompensas:

#### 1. Recompensa Disponible (Verde - #4CAF50)
- **Cuándo**: Se envía automáticamente cuando un desafío se completa
- **Trigger**: Cuando `is_completed` cambia de `False` a `True` en `UserChallenge`
- **Momento**: ANTES de que el usuario haga clic en "Reclamar"
- **Propósito**: Notificar al usuario que tiene una recompensa lista para reclamar
- **Color**: Verde (representa disponibilidad y oportunidad)
- **Estado del sistema**: El desafío está completado pero la recompensa NO ha sido reclamada
- **Ubicación en código**: `backend/services/challenge_service.py` - función `check_and_update_user_challenges()`

#### 2. Recompensa Reclamada (Naranja - #FF9800)
- **Cuándo**: Se envía cuando el usuario reclama activamente la recompensa
- **Trigger**: Cuando se crea un registro en `UserReward`
- **Momento**: DESPUÉS de que el usuario hace clic en "Reclamar"
- **Propósito**: Confirmar que la recompensa ha sido entregada exitosamente
- **Color**: Naranja (representa éxito y celebración)
- **Estado del sistema**: La recompensa ha sido reclamada y está lista para usar
- **Ubicación en código**: `backend/routers/rewards.py` - función `claim_reward()`

#### Flujo Completo del Usuario:
1. Usuario realiza acciones → Completa desafío → **Recibe email verde** (Recompensa Disponible)
2. Usuario ingresa a la plataforma → Ve la recompensa disponible → Hace clic en "Reclamar"
3. Sistema entrega la recompensa → **Recibe email naranja** (Recompensa Reclamada)

Esta implementación asegura que el usuario esté informado en ambos momentos críticos del proceso.

## Compatibilidad

- Python 3.10+
- SMTP estándar (RFC 821/5321)
- HTML5 para emails (compatible con clientes modernos)
- Fallback a texto plano si HTML no está soportado

## Mantenimiento

Para agregar nuevos tipos de notificaciones:

1. Agregar método en `EmailService` (ej: `send_booking_notification()`)
2. Llamar al método desde el router correspondiente
3. Agregar prueba en `test_email_service.py`
4. Documentar el nuevo tipo de notificación

## Referencias

- Configuración SMTP: https://docs.python.org/3/library/smtplib.html
- Gmail App Passwords: https://myaccount.google.com/apppasswords
- Email MIME: https://docs.python.org/3/library/email.mime.html
