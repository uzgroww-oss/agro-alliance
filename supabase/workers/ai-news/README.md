# AI News Worker

**Purpose:** Generate and publish news articles using the AI Worker.

**Inputs:**
- Raw agro data from external sources
- AI Worker API response
- News category configuration

**Outputs:**
- Published news articles in the database
- Notification triggers for new articles

**Flow:**
1. Fetch raw data from configured sources
2. Send to AI Worker for processing
3. Validate AI output
4. Insert into news_articles table
5. Trigger notification worker

**Future Implementation Phase:** 4
