from __future__ import annotations

from typing import BinaryIO, Optional

from bson import ObjectId
from bson.errors import InvalidId
from gridfs import GridFSBucket, NoFile
from pymongo import MongoClient

from settings import get_settings

settings = get_settings()

_mongo_client = MongoClient(settings.mongodb_uri)
_mongo_database = _mongo_client[settings.mongodb_database]
_place_photos_bucket = GridFSBucket(_mongo_database, bucket_name=settings.mongodb_place_photos_bucket)


def save_place_photo(content: BinaryIO, filename: str, content_type: Optional[str]) -> str:
    """Store the place photo in GridFS and return its ObjectId as a string."""
    metadata = {}
    if content_type:
        metadata["contentType"] = content_type
    content.seek(0)
    file_id = _place_photos_bucket.upload_from_stream(
        filename,
        content,
        metadata=metadata or None,
    )
    return str(file_id)


def delete_place_photo(file_id: Optional[str]) -> None:
    """Remove a previously stored place photo from GridFS (if it exists)."""
    if not file_id:
        return

    try:
        _place_photos_bucket.delete(ObjectId(file_id))
    except (InvalidId, NoFile):
        # If the ID is invalid or the file was already removed, we can ignore it.
        return


def open_place_photo(file_id: Optional[str]):
    """Open a stored place photo for streaming."""
    if not file_id:
        return None
    try:
        return _place_photos_bucket.open_download_stream(ObjectId(file_id))
    except (InvalidId, NoFile):
        return None
