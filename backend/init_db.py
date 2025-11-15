"""
Database tablolarını oluşturur
"""
from app.database.connection import engine, Base
from app.models import CrawlJob, Page, Link, RobotsCache

if __name__ == "__main__":
    print("Database tabloları oluşturuluyor...")
    Base.metadata.create_all(bind=engine)
    print("Database tabloları başarıyla oluşturuldu!")

