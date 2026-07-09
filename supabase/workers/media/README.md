# Media Processing Worker

**Purpose:** Process and optimize uploaded media files.

**Inputs:**
- Uploaded image/video files
- Processing configuration (resize, compress, transcode)
- Storage provider references

**Outputs:**
- Optimized media variants (thumbnails, compressed)
- Processing metadata (dimensions, duration, size)

**Flow:**
1. Receive media upload notification
2. Validate file type and size
3. Create processing variants (thumbnail, optimized)
4. Upload processed files to storage
5. Update media metadata

**Future Implementation Phase:** 6
