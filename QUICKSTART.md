# Quick Start: Deploy to Cloud Run in 5 Minutes

The fastest way to get your Amara Chronicles app live on Google Cloud Run.

## Prerequisites (One-Time Setup)

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed ([Download here](https://cloud.google.com/sdk/docs/install))
3. **API Keys**:
   - Gemini: https://aistudio.google.com/app/apikey
   - Inworld (optional): https://studio.inworld.ai/

## Step 1: Set Your Project (30 seconds)

```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID (or create a new one in console.cloud.google.com)
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Enable required services
gcloud services enable cloudbuild.googleapis.com run.googleapis.com
```

## Step 2: Store Your API Keys Securely (1 minute)

```bash
# Create secrets in Secret Manager
gcloud services enable secretmanager.googleapis.com

# Store Gemini API key
echo -n "YOUR_GEMINI_KEY_HERE" | gcloud secrets create gemini-api-key --data-file=-

# Store Inworld API key (optional)
echo -n "YOUR_INWORLD_KEY_HERE" | gcloud secrets create inworld-api-key --data-file=-
```

## Step 3: Deploy! (3 minutes)

```bash
# Build and deploy in one command
gcloud builds submit --config cloudbuild.yaml

# Configure secrets
gcloud run services update amara-chronicles \
  --region us-central1 \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,INWORLD_API_KEY=inworld-api-key:latest"
```

## Step 4: Access Your App (10 seconds)

```bash
# Get your app URL
gcloud run services describe amara-chronicles --region us-central1 --format='value(status.url)'
```

Visit the URL and click "Awake" to start your adventure!

---

## Alternative: One-Line Deploy (Advanced)

If you want to deploy without Secret Manager (not recommended for production):

```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/amara-chronicles && \
gcloud run deploy amara-chronicles \
  --image gcr.io/$PROJECT_ID/amara-chronicles \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars="GEMINI_API_KEY=YOUR_KEY,INWORLD_API_KEY=YOUR_KEY"
```

---

## Troubleshooting

**Build fails?**
- Check: `gcloud builds list`
- View logs: `gcloud builds log <BUILD_ID>`

**App doesn't work?**
- Check logs: `gcloud run logs read --service amara-chronicles --limit 50`
- Verify keys: `gcloud secrets versions access latest --secret gemini-api-key`

**Need help?**
See full guide: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## Update Your App

When you make code changes:

```bash
gcloud builds submit --config cloudbuild.yaml
```

That's it! Your changes are live in ~3 minutes.

---

## Cost Estimate

With default settings and moderate usage:
- **Development**: ~$0-5/month (mostly free tier)
- **Production**: ~$10-30/month depending on traffic

Set budget alerts in Google Cloud Console to monitor costs.

---

**🎉 Congratulations!** Your Amara Chronicles app is now live on Google Cloud Run!
