# Pre-Deployment Checklist

Use this checklist before deploying to Google Cloud Run to ensure everything is properly configured.

## ✅ Prerequisites

- [ ] Google Cloud account created with billing enabled
- [ ] Google Cloud SDK (gcloud) installed locally
- [ ] Docker installed locally (for testing)
- [ ] Gemini API Key obtained from https://aistudio.google.com/app/apikey
- [ ] (Optional) Inworld API Key obtained from https://studio.inworld.ai/

## ✅ Local Environment Setup

- [ ] `.env.local` file created with API keys
- [ ] API keys verified and working
- [ ] Local development server runs successfully (`npm run dev`)
- [ ] App loads and functions correctly at http://localhost:3000

## ✅ Build Verification

- [ ] Production build completes without errors (`npm run build`)
- [ ] Build output exists in `dist/` directory
- [ ] No TypeScript compilation errors
- [ ] All components render correctly

## ✅ Docker Verification (Optional but Recommended)

- [ ] Docker build completes successfully
- [ ] Test script runs without errors (`./test-deployment.sh`)
- [ ] App accessible at http://localhost:8080 in Docker container
- [ ] All features work in containerized environment
- [ ] API calls to Gemini/Inworld succeed from container

## ✅ Google Cloud Setup

- [ ] GCP project created or selected
- [ ] Project ID noted (format: `my-project-123`)
- [ ] Billing enabled for the project
- [ ] Required APIs enabled:
  - [ ] Cloud Build API
  - [ ] Cloud Run API
  - [ ] Container Registry API
  - [ ] (Optional) Secret Manager API

## ✅ Security Configuration

- [ ] API keys never committed to git
- [ ] `.env.local` in `.gitignore`
- [ ] Secrets stored in Google Secret Manager (recommended)
- [ ] IAM permissions reviewed

## ✅ Deployment Commands Ready

Choose your deployment method:

### Option A: Cloud Build (Recommended)
```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Deploy with Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/amara-chronicles

# Deploy to Cloud Run (with secrets)
gcloud run deploy amara-chronicles \
  --image gcr.io/YOUR_PROJECT_ID/amara-chronicles \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,INWORLD_API_KEY=inworld-api-key:latest"
```

### Option B: Using cloudbuild.yaml
```bash
gcloud builds submit --config cloudbuild.yaml
```

## ✅ Post-Deployment Verification

- [ ] Service deployed successfully
- [ ] Cloud Run URL accessible
- [ ] App loads without errors
- [ ] "Awake" button works and starts the game
- [ ] Story generation works (Gemini API)
- [ ] (If configured) Voice narration works (Inworld API)
- [ ] Character sheet displays correctly
- [ ] Inventory system functions
- [ ] Save/Load features work
- [ ] Mobile responsiveness verified

## ✅ Monitoring and Maintenance

- [ ] Cloud Run logs accessible and reviewed
- [ ] Error tracking set up
- [ ] Cost alerts configured
- [ ] Resource limits appropriate for usage
- [ ] Backup/restore procedures documented

## Common Issues and Solutions

### Build Fails
- Ensure all dependencies in `package.json` are correct
- Check that `dist` is in `.dockerignore`
- Verify Node version compatibility (20+)

### API Errors
- Confirm API keys are correctly set in Cloud Run
- Check API key quotas and limits
- Review application logs for specific errors

### App Won't Load
- Verify service allows unauthenticated access
- Check nginx configuration in Dockerfile
- Ensure port 8080 is correctly configured
- Review Cloud Run service logs

### High Costs
- Set appropriate min/max instances
- Configure memory and CPU limits
- Implement request caching if needed
- Use development environment for testing

## Support Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Gemini API Docs](https://ai.google.dev/docs)
- [Inworld AI Docs](https://docs.inworld.ai/)
- [Docker Documentation](https://docs.docker.com/)

---

**Ready to deploy?** Follow the instructions in [DEPLOYMENT.md](DEPLOYMENT.md)
