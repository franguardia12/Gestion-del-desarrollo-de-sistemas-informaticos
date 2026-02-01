from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any
from datetime import date

class PlaceSummaryAvailability(BaseModel):
    start: date = Field(..., alias="start_date") 
    end: date = Field(..., alias="end_date")
    
    class Config:
        from_attributes = True

class PlaceSummarySchema(BaseModel):
    id: int
    name: str
    
    city: Optional[str] = Field(None, alias="city_state") 
    country: Optional[str] = None
    category: Optional[str] = None
    
    description_short: Optional[str] = Field(None, alias="description") 

    rating_avg: float
    price_per_night: Optional[float] = None
    
    photos: List[str] = []
    badges: List[str] = []  # Badge icons: e.g., ["popular", "new"]

    availability: List[PlaceSummaryAvailability] = Field(..., alias="unavailabilities") 
    
    class Config:
        from_attributes = True

    @field_validator("photos", mode="before")
    @classmethod
    def ensure_photo_urls(cls, value: Any) -> List[str]:
        if isinstance(value, list):
            urls: List[str] = []
            for item in value:
                if isinstance(item, str):
                    urls.append(item)
                else:
                    url = getattr(item, "url", None)
                    if url:
                        urls.append(url)
            return urls
        if value is None:
            return []
        return value
