# backend/create_db_tables.py

import sys
import os

# Ajuste temporal del path para que Python encuentre 'database' y 'models'
# Esto asume que estás ejecutando el script desde la carpeta 'backend'
# sys.path.append(os.path.dirname(os.path.abspath(__file__))) 
# Comentamos la línea de sys.path ya que Uvicorn ya debe haber configurado el path.

from database import engine # Importa el motor y la base declarativa de SQLAlchemy
from models import Base,User,Place # Importa todos tus modelos (User, Place, etc.)

def create_tables():
    print("Intentando crear todas las tablas definidas en models.py...")
    
    # Este comando le dice a SQLAlchemy que cree todas las tablas
    # en la base de datos a la que apunta 'engine'.
    Base.metadata.create_all(bind=engine)
    
    print("¡Tablas creadas con éxito! Ahora puedes registrarte.")

if __name__ == "__main__":
    create_tables()