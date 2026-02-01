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
_review_photos_bucket = GridFSBucket(_mongo_database, bucket_name=settings.mongodb_review_photos_bucket)


def save_review_photo(content: BinaryIO, filename: str, content_type: Optional[str]) -> str:
    metadata = {}
    if content_type:
        metadata["contentType"] = content_type
    content.seek(0)
    file_id = _review_photos_bucket.upload_from_stream(
        filename,
        content,
        metadata=metadata or None,
    )
    return str(file_id)


def delete_review_photo(file_id: Optional[str]) -> None:
    if not file_id:
        return

    try:
        _review_photos_bucket.delete(ObjectId(file_id))
    except (InvalidId, NoFile):
        return


def open_review_photo(file_id: Optional[str]):
    if not file_id:
        return None
    try:
        return _review_photos_bucket.open_download_stream(ObjectId(file_id))
    except (InvalidId, NoFile):
        return None
