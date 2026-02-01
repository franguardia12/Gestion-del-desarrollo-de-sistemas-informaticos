import React, { useRef } from 'react';
import { PlaceCard, PlaceSummary } from '../PlaceCard/PlaceCard';
import './PlaceCarousel.css';

interface PlaceCarouselProps {
    title: string;
    places: PlaceSummary[];
    actionsRenderer?: (place: PlaceSummary) => React.ReactNode;
    isLoading?: boolean;
    error?: string | null;
}

export function PlaceCarousel({ title, places, actionsRenderer, isLoading, error }: PlaceCarouselProps) {
    const carouselRef = useRef<HTMLDivElement>(null);

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


    const showCarousel = !isLoading && places && places.length > 0;
    const showEmptyMessage = !isLoading && (!places || places.length === 0);
    const showLoading = isLoading;

    return (
        <section className="place-carousel-navigation-container">
            <h2 style={{ position: 'absolute', top: '-15px', left: '16px', zIndex: 11, paddingRight: '10px' }}>
                {title}
            </h2>

            {showLoading && <p>Cargando establecimientos...</p>}
            {error && <p style={{color: 'red'}}>Error: {error}</p>}

            {showCarousel && (
                <>
                    <button className="scroll-button left" onClick={scrollLeft} aria-label="Anterior">&lt;</button>
                    
                    <div className="carousel-container" ref={carouselRef}>
                    {places.map((place: PlaceSummary) => (
                        <div key={place.id} className='carousel-item'>
                            <PlaceCard 
                                place={place} 
                                actions={actionsRenderer ? actionsRenderer(place) : undefined} 
                            />
                        </div>
                    ))}
                    </div>

                    <button className="scroll-button right" onClick={scrollRight} aria-label="Siguiente">&gt;</button>
                </>
            )}

            {showEmptyMessage && (
                <p>Aún no has publicado ningún establecimiento.</p>
            )}
        </section>
    );
}