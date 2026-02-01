"""
Script de prueba para el servicio de notificaciones por correo
"""
from services.email_service import get_email_service


def test_review_notification():
    """Prueba el envío de notificación de reseña"""
    print("Probando notificación de reseña...")
    email_service = get_email_service()
    
    if not email_service.enabled:
        print("❌ El servicio de email no está configurado.")
        print("Por favor, configura las variables SMTP en el archivo .env")
        return False
    
    result = email_service.send_review_notification(
        owner_email="propietario@ejemplo.com",
        owner_name="Juan Pérez",
        place_name="Hotel Vista Hermosa",
        reviewer_name="María García",
        rating=5,
        review_title="Excelente lugar para vacacionar"
    )
    
    if result:
        print("✅ Notificación de reseña enviada exitosamente")
    else:
        print("❌ Error al enviar notificación de reseña")
    
    return result


def test_reward_notification():
    """Prueba el envío de notificación de recompensa"""
    print("\nProbando notificación de recompensa...")
    email_service = get_email_service()
    
    if not email_service.enabled:
        print("❌ El servicio de email no está configurado.")
        print("Por favor, configura las variables SMTP en el archivo .env")
        return False
    
    result = email_service.send_reward_notification(
        user_email="usuario@ejemplo.com",
        user_name="María García",
        reward_title="Descuento del 20% en próxima reserva",
        reward_description="Obtén un 20% de descuento en tu próxima reserva"
    )
    
    if result:
        print("✅ Notificación de recompensa enviada exitosamente")
    else:
        print("❌ Error al enviar notificación de recompensa")
    
    return result


def main():
    """Ejecuta todas las pruebas"""
    print("=" * 60)
    print("Prueba del Servicio de Notificaciones por Correo")
    print("=" * 60)
    
    email_service = get_email_service()
    
    print(f"\nEstado del servicio de email: ", end="")
    if email_service.enabled:
        print("✅ CONFIGURADO")
        print(f"Host SMTP: {email_service.smtp_host}:{email_service.smtp_port}")
        print(f"Usuario: {email_service.smtp_username}")
        print(f"Email desde: {email_service.smtp_from_email}")
        print(f"TLS: {'Sí' if email_service.smtp_use_tls else 'No'}")
    else:
        print("❌ NO CONFIGURADO")
        print("\nPara configurar el servicio de email:")
        print("1. Copia .env.example a .env")
        print("2. Edita .env y configura las variables SMTP")
        print("\nEjemplo para Gmail:")
        print("  SMTP_HOST=smtp.gmail.com")
        print("  SMTP_PORT=587")
        print("  SMTP_USERNAME=tu_correo@gmail.com")
        print("  SMTP_PASSWORD=tu_contraseña_de_aplicacion")
        print("  SMTP_FROM_EMAIL=tu_correo@gmail.com")
        print("  SMTP_USE_TLS=true")
        print("\n⚠️  Para Gmail necesitas generar una contraseña de aplicación:")
        print("   https://myaccount.google.com/apppasswords")
        return
    
    print("\n" + "=" * 60)
    print("Ejecutando pruebas...")
    print("=" * 60)
    
    review_result = test_review_notification()
    reward_result = test_reward_notification()
    
    print("\n" + "=" * 60)
    print("Resultados de las pruebas:")
    print("=" * 60)
    print(f"Notificación de reseña: {'✅ PASS' if review_result else '❌ FAIL'}")
    print(f"Notificación de recompensa: {'✅ PASS' if reward_result else '❌ FAIL'}")
    
    if review_result and reward_result:
        print("\n🎉 ¡Todas las pruebas pasaron exitosamente!")
    else:
        print("\n⚠️  Algunas pruebas fallaron. Verifica la configuración SMTP.")


if __name__ == "__main__":
    main()
