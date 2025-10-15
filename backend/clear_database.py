#!/usr/bin/env python3
"""
Database Data Clearance Script for Action Learning Platform
===========================================================

This script removes ALL data from ALL tables while keeping the table structure intact.
Perfect for showcase preparation - gives you a clean database with all tables ready.

IMPORTANT: This will permanently delete all data! Make sure you have backups if needed.
"""

import sys
import os

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.database import engine, Base
from app.database import (
    User, 
    TweetAuthorDB, 
    SavedTweet, 
    TweetAnalysis, 
    AnalysisReport
)

def clear_all_data():
    """
    Clear all data from all tables while preserving table structure.
    Handles foreign key constraints by deleting in the correct order.
    """
    
    # Create a session
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🧹 Starting database clearance...")
        print("=" * 50)
        
        # Get initial counts for reporting
        initial_counts = {}
        tables_to_clear = [
            ("analysis_reports", AnalysisReport),
            ("tweet_analyses", TweetAnalysis), 
            ("saved_tweets", SavedTweet),
            ("tweet_authors", TweetAuthorDB),
            ("users", User)
        ]
        
        print("📊 Current data counts:")
        for table_name, model in tables_to_clear:
            count = session.query(model).count()
            initial_counts[table_name] = count
            print(f"  {table_name}: {count} records")
        
        total_records = sum(initial_counts.values())
        print(f"\n📈 Total records to delete: {total_records}")
        
        if total_records == 0:
            print("✅ Database is already empty!")
            return
        
        # Confirm deletion
        print("\n⚠️  WARNING: This will permanently delete ALL data from ALL tables!")
        print("   Table structures will be preserved, but all data will be lost.")
        response = input("\n🤔 Are you sure you want to continue? (type 'yes' to confirm): ")
        
        if response.lower() != 'yes':
            print("❌ Operation cancelled.")
            return
        
        print("\n🗑️  Deleting data in safe order (respecting foreign keys)...")
        
        # Delete in reverse dependency order to avoid foreign key violations
        deletion_order = [
            ("analysis_reports", AnalysisReport, "Analysis reports"),
            ("tweet_analyses", TweetAnalysis, "Tweet analyses"), 
            ("saved_tweets", SavedTweet, "Saved tweets"),
            ("tweet_authors", TweetAuthorDB, "Tweet authors"),
            ("users", User, "Users")
        ]
        
        deleted_counts = {}
        
        for table_name, model, description in deletion_order:
            if initial_counts[table_name] > 0:
                print(f"  🗑️  Deleting {description}...")
                deleted_count = session.query(model).delete()
                deleted_counts[table_name] = deleted_count
                session.commit()
                print(f"     ✅ Deleted {deleted_count} records from {table_name}")
            else:
                print(f"  ⏭️  Skipping {description} (already empty)")
                deleted_counts[table_name] = 0
        
        print("\n" + "=" * 50)
        print("🎉 Database clearance completed successfully!")
        print("\n📊 Deletion summary:")
        
        total_deleted = 0
        for table_name, description in [
            ("analysis_reports", "Analysis reports"),
            ("tweet_analyses", "Tweet analyses"), 
            ("saved_tweets", "Saved tweets"),
            ("tweet_authors", "Tweet authors"),
            ("users", "Users")
        ]:
            deleted = deleted_counts.get(table_name, 0)
            total_deleted += deleted
            print(f"  {description}: {deleted} records deleted")
        
        print(f"\n🎯 Total records deleted: {total_deleted}")
        
        # Verify tables are empty
        print("\n🔍 Verifying tables are empty...")
        all_empty = True
        for table_name, model in tables_to_clear:
            remaining = session.query(model).count()
            if remaining == 0:
                print(f"  ✅ {table_name}: empty")
            else:
                print(f"  ❌ {table_name}: {remaining} records remaining")
                all_empty = False
        
        if all_empty:
            print("\n🎊 Perfect! All tables are now empty and ready for your showcase!")
            print("   Table structures are preserved and your app is ready to use.")
        else:
            print("\n⚠️  Warning: Some tables still contain data. Check for foreign key issues.")
            
    except Exception as e:
        print(f"\n❌ Error during database clearance: {str(e)}")
        session.rollback()
        raise
    finally:
        session.close()

def reset_auto_increment():
    """
    Reset auto-increment sequences for a completely fresh start.
    This ensures IDs start from 1 again.
    """
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("\n🔄 Resetting auto-increment sequences...")
        
        # Get database type to use appropriate SQL
        db_url = str(engine.url)
        
        if 'postgresql' in db_url:
            # PostgreSQL reset sequences
            sequences = [
                'users_id_seq',
                'tweet_authors_id_seq', 
                'saved_tweets_id_seq',
                'tweet_analyses_id_seq',
                'analysis_reports_id_seq'
            ]
            
            for seq in sequences:
                try:
                    session.execute(text(f"ALTER SEQUENCE {seq} RESTART WITH 1;"))
                    print(f"  ✅ Reset sequence: {seq}")
                except Exception as e:
                    print(f"  ⚠️  Could not reset {seq}: {str(e)}")
            
        elif 'sqlite' in db_url:
            # SQLite reset sequences
            session.execute(text("DELETE FROM sqlite_sequence;"))
            print("  ✅ Reset SQLite sequences")
            
        else:
            print("  ℹ️  Auto-increment reset not implemented for this database type")
        
        session.commit()
        print("  🎯 Auto-increment sequences reset successfully!")
        
    except Exception as e:
        print(f"  ⚠️  Warning: Could not reset sequences: {str(e)}")
        session.rollback()
    finally:
        session.close()

def main():
    """Main function to run the database clearance"""
    
    print("🚀 Action Learning Platform - Database Clearance Tool")
    print("=" * 60)
    print("This tool will remove ALL data from your database for showcase preparation.")
    print("Table structures will be preserved, but all content will be deleted.")
    print("=" * 60)
    
    try:
        # Test database connection
        print("🔌 Testing database connection...")
        Session = sessionmaker(bind=engine)
        session = Session()
        session.execute(text("SELECT 1"))
        session.close()
        print("  ✅ Database connection successful!")
        
        # Clear all data
        clear_all_data()
        
        # Reset sequences for fresh start
        reset_auto_increment()
        
        print("\n" + "🎉" * 20)
        print("🎊 SHOWCASE READY! 🎊")
        print("Your database is now completely clean and ready for the demo.")
        print("All tables exist and your application should work perfectly!")
        print("🎉" * 20)
        
    except ImportError as e:
        print(f"❌ Import error: {str(e)}")
        print("Make sure you're running this script from the backend directory.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        print("\nTroubleshooting tips:")
        print("1. Make sure your database is running")
        print("2. Check your database configuration in app/config.py")
        print("3. Ensure you have the necessary database permissions")
        sys.exit(1)

if __name__ == "__main__":
    main() 