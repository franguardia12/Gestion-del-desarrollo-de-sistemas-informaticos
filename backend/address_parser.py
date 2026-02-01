def parse_full_address(full_address: str) -> dict:
    """
    Parsea la dirección completa de LocationIQ y extrae:
    - country_filter
    - city_state_filter (todo entre la calle y el código postal/país)
    - street_filter
    """
    if not full_address:
        return {}
    
    # Dividir por comas
    parts = [part.strip() for part in full_address.split(',')]
    
    if len(parts) < 3:
        return {}
    
    parsed = {}
    
    # El último elemento es siempre el país
    parsed['country_filter'] = parts[-1]
    
    # Buscar la calle (puede ser el primer o segundo elemento)
    street_index = 0
    if parts[0].strip().replace('.', '').isdigit():
        # Si el primer elemento es un número, la calle es el segundo
        street_index = 1
    else:
        # Si no, la calle es el primero
        street_index = 0
    
    parsed['street_filter'] = parts[street_index]
    
    # Todo lo que está entre la calle y el país es city_state_filter
    # Pero excluimos el último elemento (país) y posible código postal
    start_index = street_index + 1
    end_index = len(parts) - 1
    
    # Si el penúltimo elemento parece ser un código postal (combinación de letras y números)
    # lo excluimos también
    if (end_index - 1 >= start_index and 
        any(c.isdigit() for c in parts[end_index - 1]) and 
        any(c.isalpha() for c in parts[end_index - 1])):
        end_index = end_index - 1
    
    if start_index < end_index:
        parsed['city_state_filter'] = ', '.join(parts[start_index:end_index])
    else:
        parsed['city_state_filter'] = None
    
    return parsed