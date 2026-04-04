import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["sahayak_db"]
    docs = await db["testimonies"].find().to_list(length=100)
    for doc in docs:
        print(doc.get("title"), "HAS FRAGMENTS:" if "fragments" in doc else "NO FRAGMENTS")
        
asyncio.run(main())
