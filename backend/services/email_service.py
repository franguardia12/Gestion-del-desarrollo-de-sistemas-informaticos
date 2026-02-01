"""
Servicio de notificaciones por correo electrónico
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

from settings import get_settings

logger = logging.getLogger(__name__)


class EmailService:
    """Servicio para enviar correos electrónicos usando SMTP"""
    
    def __init__(self):
        settings = get_settings()
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.smtp_username = settings.smtp_username
        self.smtp_password = settings.smtp_password
        self.smtp_from_email = settings.smtp_from_email
        self.smtp_use_tls = settings.smtp_use_tls
        self.enabled = all([
            self.smtp_host,
            self.smtp_port,
            self.smtp_username,
            self.smtp_password,
            self.smtp_from_email
        ])
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None
    ) -> bool:
        """
        Envía un correo electrónico.
        
        Args:
            to_email: Dirección de correo del destinatario
            subject: Asunto del correo
            body_text: Cuerpo del mensaje en texto plano
            body_html: Cuerpo del mensaje en HTML (opcional)
        
        Returns:
            True si el correo se envió exitosamente, False en caso contrario
        """
        if not self.enabled:
            logger.warning(
                "Email service is not configured. Email would be sent to %s with subject: %s",
                to_email,
                subject
            )
            return False
        
        try:
            # Crear el mensaje
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.smtp_from_email
            msg['To'] = to_email
            
            # Agregar versión texto plano
            part_text = MIMEText(body_text, 'plain', 'utf-8')
            msg.attach(part_text)
            
            # Agregar versión HTML si está disponible
            if body_html:
                part_html = MIMEText(body_html, 'html', 'utf-8')
                msg.attach(part_html)
            
            # Conectar al servidor SMTP y enviar
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.smtp_use_tls:
                    server.starttls()
                
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    def send_review_notification(
        self,
        owner_email: str,
        owner_name: str,
        place_name: str,
        reviewer_name: str,
        rating: int,
        review_title: str
    ) -> bool:
        """
        Envía notificación al propietario cuando alguien hace una reseña.
        
        Args:
            owner_email: Email del propietario del lugar
            owner_name: Nombre del propietario
            place_name: Nombre del lugar reseñado
            reviewer_name: Nombre de quien hizo la reseña
            rating: Calificación (1-5 estrellas)
            review_title: Título de la reseña
        
        Returns:
            True si el correo se envió exitosamente
        """
        subject = f"Nueva reseña en tu publicación: {place_name}"
        
        stars = "⭐" * rating
        
        body_text = f"""
Hola {owner_name},

¡Tienes una nueva reseña en tu publicación!

Lugar: {place_name}
Autor: {reviewer_name}
Calificación: {stars} ({rating}/5)
Título: {review_title}

Ingresa a la plataforma para ver la reseña completa y responder.

Saludos,
El equipo de ViajerosXP
        """.strip()
        
        body_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }}
        .review-info {{ background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }}
        .stars {{ color: #FFD700; font-size: 20px; }}
        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🎉 Nueva Reseña Recibida</h2>
        </div>
        <div class="content">
            <p>Hola <strong>{owner_name}</strong>,</p>
            <p>¡Tienes una nueva reseña en tu publicación!</p>
            
            <div class="review-info">
                <p><strong>Lugar:</strong> {place_name}</p>
                <p><strong>Autor:</strong> {reviewer_name}</p>
                <p><strong>Calificación:</strong> <span class="stars">{stars}</span> ({rating}/5)</p>
                <p><strong>Título:</strong> {review_title}</p>
            </div>
            
            <p>Ingresa a la plataforma para ver la reseña completa y responder.</p>
            
            <p>Saludos,<br>El equipo de ViajerosXP</p>
        </div>
        <div class="footer">
            <p>Este es un correo automático, por favor no responder.</p>
        </div>
    </div>
</body>
</html>
        """.strip()
        
        return self.send_email(owner_email, subject, body_text, body_html)
    
    def send_reward_notification(
        self,
        user_email: str,
        user_name: str,
        reward_title: str,
        reward_description: str
    ) -> bool:
        """
        Envía notificación al usuario cuando reclama una recompensa.
        
        Args:
            user_email: Email del usuario
            user_name: Nombre del usuario
            reward_title: Título de la recompensa
            reward_description: Descripción de la recompensa
        
        Returns:
            True si el correo se envió exitosamente
        """
        subject = f"¡Recompensa reclamada exitosamente! - {reward_title}"
        
        body_text = f"""
Hola {user_name},

¡Felicidades! Has reclamado exitosamente una recompensa.

Recompensa: {reward_title}
Descripción: {reward_description}

Ya puedes hacer uso de tu recompensa. Ingresa a la plataforma para ver más detalles.

¡Sigue completando desafíos para obtener más recompensas!

Saludos,
El equipo de ViajerosXP
        """.strip()
        
        body_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }}
        .reward-info {{ background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #FF9800; }}
        .celebration {{ font-size: 40px; text-align: center; margin: 20px 0; }}
        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🎁 ¡Recompensa Reclamada!</h2>
        </div>
        <div class="content">
            <div class="celebration">🎉 🏆 🎉</div>
            
            <p>Hola <strong>{user_name}</strong>,</p>
            <p>¡Felicidades! Has reclamado exitosamente una recompensa.</p>
            
            <div class="reward-info">
                <p><strong>Recompensa:</strong> {reward_title}</p>
                <p><strong>Descripción:</strong> {reward_description}</p>
            </div>
            
            <p>Ya puedes hacer uso de tu recompensa. Ingresa a la plataforma para ver más detalles.</p>
            
            <p>¡Sigue completando desafíos para obtener más recompensas!</p>
            
            <p>Saludos,<br>El equipo de ViajerosXP</p>
        </div>
        <div class="footer">
            <p>Este es un correo automático, por favor no responder.</p>
        </div>
    </div>
</body>
</html>
        """.strip()
        
        return self.send_email(user_email, subject, body_text, body_html)
    
    def send_reward_available_notification(
        self,
        user_email: str,
        user_name: str,
        reward_title: str,
        reward_description: str,
        challenge_title: str
    ) -> bool:
        """
        Envía notificación al usuario cuando una recompensa está disponible para reclamar.
        Esta notificación se envía ANTES de que el usuario haga clic en "Reclamar".
        
        Args:
            user_email: Email del usuario
            user_name: Nombre del usuario
            reward_title: Título de la recompensa
            reward_description: Descripción de la recompensa
            challenge_title: Título del desafío completado
        
        Returns:
            True si el correo se envió exitosamente
        """
        subject = f"¡Recompensa Disponible! - {reward_title}"
        
        body_text = f"""
Hola {user_name},

¡Felicidades! Has completado el desafío "{challenge_title}" y ahora tienes una recompensa disponible para reclamar.

Recompensa: {reward_title}
Descripción: {reward_description}

Ingresa a la plataforma y ve a la sección de recompensas para reclamar tu premio.

¡Sigue completando desafíos para obtener más recompensas!

Saludos,
El equipo de ViajerosXP
        """.strip()
        
        body_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
        .content {{ background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }}
        .reward-info {{ background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }}
        .celebration {{ font-size: 40px; text-align: center; margin: 20px 0; }}
        .button {{ display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }}
        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🎁 ¡Nueva Recompensa Disponible!</h2>
        </div>
        <div class="content">
            <div class="celebration">🎉 ✨ 🎉</div>
            
            <p>Hola <strong>{user_name}</strong>,</p>
            <p>¡Felicidades! Has completado el desafío <strong>"{challenge_title}"</strong> y ahora tienes una recompensa disponible para reclamar.</p>
            
            <div class="reward-info">
                <p><strong>Recompensa:</strong> {reward_title}</p>
                <p><strong>Descripción:</strong> {reward_description}</p>
            </div>
            
            <p>Ingresa a la plataforma y ve a la sección de recompensas para reclamar tu premio.</p>
            
            <p>¡Sigue completando desafíos para obtener más recompensas!</p>
            
            <p>Saludos,<br>El equipo de ViajerosXP</p>
        </div>
        <div class="footer">
            <p>Este es un correo automático, por favor no responder.</p>
        </div>
    </div>
</body>
</html>
        """.strip()
        
        return self.send_email(user_email, subject, body_text, body_html)


# Instancia global del servicio
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Obtiene la instancia del servicio de email (singleton)"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
