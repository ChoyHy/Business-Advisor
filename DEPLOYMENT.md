# Deployment Guide - Google Cloud Run

This guide explains how to deploy the SME Invoice & Expense Manager to **Google Cloud Run**.

## Prerequisites

1.  **Google Cloud Project**: Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2.  **Google Cloud SDK**: Install and initialize the [gcloud CLI](https://cloud.google.com/sdk/docs/install).
3.  **Gemini API Key**: Ensure you have your API key from [Google AI Studio](https://aistudio.google.com/).

## Step 1: Build for Production

The application uses a full-stack Express + Vite architecture. Before deploying, you should ensure the frontend can be built successfully.

```bash
npm run build
```

## Step 2: Deploy using gcloud CLI

You can deploy directly from the source code. The `gcloud` CLI will automatically detect the `package.json`, build the container, and deploy it.

Run the following command in the root directory:

```bash
gcloud run deploy sme-manager \
  --source . \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=your_api_key_here,NODE_ENV=production"
```

*Replace `your_api_key_here` with your actual Gemini API key.*

## Step 3: Database Persistence (Important)

This application uses **SQLite** (`better-sqlite3`), which stores data in a local file (`sme_business.db`).

### The Ephemeral Nature of Cloud Run
Cloud Run instances are ephemeral. This means:
- When the instance scales to zero (no traffic), the local file system is wiped.
- When a new instance starts, it starts with an empty `sme_business.db`.
- Data is **NOT** shared between multiple concurrent instances.

### Production Recommendations
For a real-world production environment, you should migrate from SQLite to a persistent database:

1.  **Google Cloud SQL**: Use Managed PostgreSQL or MySQL. Update `server.ts` to connect to Cloud SQL instead of SQLite.
2.  **Firebase Firestore**: A scalable NoSQL option that is very easy to integrate with Node.js.
3.  **Cloud Storage FUSE**: You can mount a Cloud Storage bucket as a volume to persist the SQLite file, though this is generally slower than a dedicated database.

## Environment Variables Summary

| Variable | Required | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Yes | Your Google AI Studio API Key |
| `NODE_ENV` | Yes | Set to `production` for optimized serving |
| `APP_URL` | No | The public URL of your service (for OAuth/callbacks) |
