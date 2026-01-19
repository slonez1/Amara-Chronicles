# Deploying Amara Chronicles to Google Cloud Run

This guide will walk you through deploying the Amara Chronicles app to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud SDK (gcloud CLI)** installed on your local machine
   - Download from: https://cloud.google.com/sdk/docs/install
3. **Docker** installed locally (for building the container image)
4. **API Keys**:
   - Gemini API Key (get from https://aistudio.google.com/app/apikey)
   - (Optional) Inworld API Key for voice narration (get from https://studio.inworld.ai/)

## Step 1: Set Up Google Cloud Project

```bash
# Set your project ID
export PROJECT_ID="your-project-id"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com
```

## Step 2: Configure Environment Variables

Create a `.env.production` file with your API keys:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
INWORLD_API_KEY=your_inworld_api_key_base64_here
```

**IMPORTANT**: Never commit this file to version control!

## Step 3: Build and Deploy

### Option A: Using Cloud Build (Recommended)

This builds the Docker image in Google Cloud:

```bash
# Submit the build to Cloud Build
gcloud builds submit --tag gcr.io/$PROJECT_ID/amara-chronicles

# Deploy to Cloud Run
gcloud run deploy amara-chronicles \
  --image gcr.io/$PROJECT_ID/amara-chronicles \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars="GEMINI_API_KEY=your_key_here,INWORLD_API_KEY=your_key_here"
```

### Option B: Build Locally and Push

```bash
# Build the Docker image locally
docker build -t gcr.io/$PROJECT_ID/amara-chronicles .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/amara-chronicles

# Deploy to Cloud Run
gcloud run deploy amara-chronicles \
  --image gcr.io/$PROJECT_ID/amara-chronicles \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars="GEMINI_API_KEY=your_key_here,INWORLD_API_KEY=your_key_here"
```

## Step 4: Configure Environment Variables Securely (Recommended)

Instead of passing API keys directly, use Google Secret Manager:

```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Create secrets
echo -n "your_gemini_api_key" | gcloud secrets create gemini-api-key --data-file=-
echo -n "your_inworld_api_key" | gcloud secrets create inworld-api-key --data-file=-

# Deploy with secrets
gcloud run deploy amara-chronicles \
  --image gcr.io/$PROJECT_ID/amara-chronicles \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,INWORLD_API_KEY=inworld-api-key:latest"
```

## Step 5: Access Your Application

After deployment, Cloud Run will provide a URL like:
```
https://amara-chronicles-<hash>-uc.a.run.app
```

Visit this URL to access your deployed application!

## Updating the Application

When you make changes to the code:

```bash
# Rebuild and redeploy
gcloud builds submit --tag gcr.io/$PROJECT_ID/amara-chronicles && \
gcloud run deploy amara-chronicles \
  --image gcr.io/$PROJECT_ID/amara-chronicles \
  --platform managed \
  --region us-central1
```

## Troubleshooting

### Build Fails

If the Docker build fails:
1. Check that all dependencies are correctly listed in `package.json`
2. Ensure `dist` directory is in `.dockerignore`
3. Try building locally first: `docker build -t test .`

### App Doesn't Load

1. Check logs: `gcloud run logs read --service amara-chronicles --limit 50`
2. Verify environment variables are set correctly
3. Ensure the service allows unauthenticated access

### API Errors

1. Verify your Gemini API key is valid and has quota
2. Check that environment variables are properly set in Cloud Run
3. Review application logs for specific error messages

## Cost Optimization

Cloud Run pricing is based on:
- CPU and memory usage
- Number of requests
- Data transfer

To optimize costs:
1. Set appropriate CPU and memory limits
2. Use minimum instances=0 for development
3. Consider setting maximum instances to control costs

```bash
# Set resource limits
gcloud run services update amara-chronicles \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10
```

## Security Best Practices

1. **Never commit API keys** to version control
2. Use **Secret Manager** for production deployments
3. Enable **HTTPS only** (Cloud Run does this by default)
4. Set up **custom domains** with SSL certificates
5. Implement **rate limiting** if needed
6. Review **IAM permissions** regularly

## Custom Domain (Optional)

To use a custom domain:

```bash
# Map your domain
gcloud run services update amara-chronicles \
  --platform managed \
  --region us-central1
  
gcloud run domain-mappings create \
  --service amara-chronicles \
  --domain your-domain.com \
  --region us-central1
```

Then update your DNS records as instructed by Cloud Run.

## Support

For issues specific to:
- **Cloud Run**: https://cloud.google.com/run/docs
- **Gemini API**: https://ai.google.dev/docs
- **Inworld AI**: https://docs.inworld.ai/

---

**Note**: This deployment uses nginx to serve the static files generated by Vite. The application runs entirely in the browser, with API calls made directly to Gemini and Inworld services.
