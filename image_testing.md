# Image Integration Testing Rules

- Always use base64-encoded images for all tests and requests.
- Accepted formats: JPEG, PNG, WEBP only. No SVG, BMP, HEIC.
- Do not upload blank, solid-color, or uniform-variance images — every image must contain real visual features (objects, edges, textures, shadows).
- If the image is not PNG/JPEG/WEBP, transcode first, then re-detect and update the MIME.
- If animated, extract first frame only.
- Resize large images to reasonable bounds.

OCR endpoint test: POST /api/ai/ocr with {"image_base64": "..."} returns {"merchant": str, "nominal": number, "tanggal": str}.
