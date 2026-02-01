import React, { useState, useEffect, useRef } from 'react';
import { PlaceCard, PlaceSummary } from '../PlaceCard/PlaceCard';
import { buildApiUrl, fetchJson } from '../../lib/api';
import './FeaturedCarusel.css';

export function FeaturedCarousel() {
    const [featuredPlaces, setFeaturedPlaces] = useState<PlaceSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const carouselRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchFeaturedPlaces = async () => {
            try {
                const url = buildApiUrl('/api/featured');
                const data = await fetchJson<PlaceSummary[]>(url.toString());
                setFeaturedPlaces(data);
            } catch (error) {
                console.error("Error al cargar lugares destacados:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFeaturedPlaces();
    }, []); 

    const scrollStep = 3;

    const scrollByStep = (direction: number) => {
        if (carouselRef.current) {
            const itemElement = carouselRef.current.querySelector('.carousel-item');
            const itemWidth = itemElement ? itemElement.clientWidth + 20 : 320; 
            
            const scrollDistance = itemWidth * scrollStep * direction;
            
            carouselRef.current.scrollBy({
                left: scrollDistance,
                behavior: 'smooth'
            });
        }
    };

    const scrollRight = () => scrollByStep(1);
    const scrollLeft = () => scrollByStep(-1);

    return (
        <section className="carousel-navigation-container">
            <h2 style={{ position: 'absolute', top: '-15px', left: '16px', zIndex: 11, paddingRight: '10px' }}>
                Lugares Destacados
            </h2>

            {isLoading && <p>Cargando los mejores destinos...</p>}

            {!isLoading && featuredPlaces.length > 0 && (
                <>
                    <button 
                        className="scroll-button left" 
                        onClick={scrollLeft}
                        aria-label="Anterior"
                    >
                        &lt;
                    </button>
                    <div
                        className="carousel-container" 
                        ref={carouselRef}
                    >
                    {featuredPlaces.map((place: PlaceSummary) => (
                        <div key={place.id} className='carousel-item'>
                            <PlaceCard place={place} />
                        </div>
                    ))}
                    </div>
                    <button 
                        className="scroll-button right" 
                        onClick={scrollRight}
                        aria-label="Siguiente"
                    >
                        &gt;
                    </button>
                </>
            )}

            {!isLoading && featuredPlaces.length === 0 && (
                <p>Lo sentimos, no hay lugares destacados disponibles en este momento.</p>
            )}
        </section>
    );
}
