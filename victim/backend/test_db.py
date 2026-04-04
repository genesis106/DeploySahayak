from pymongo import MongoClient
import os

client = MongoClient("mongodb://localhost:27017")
db = client["sahayak_db"]

media = list(db["media_uploads"].find({}, {"_id": 1, "case_id": 1, "filename": 1}))
print(f"Media ({len(media)}):")
for m in media:
    print(f"  {m}")

links = list(db["shared_links"].find({}, {"_id": 1, "case_id": 1, "recipient_name": 1}))
print(f"\nLinks ({len(links)}):")
for L in links:
    print(f"  {L}")

