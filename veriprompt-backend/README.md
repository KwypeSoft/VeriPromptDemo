# VeriPrompt Backend

Serverless Node.js backend targeting Google Cloud Functions to generate AI imagery, enrich metadata for NFTs, pin outputs to IPFS, and return mint-ready payloads for the VeriPrompt web app.

## High-Level Flow

1. **Receive prompt** via `POST /generateAndStore`.
2. **Generate image** with Vertex AI Imagen, using exponential backoff to survive quota and network issues.
3. **Derive attributes** from Vertex output plus Google Vision label detection.
4. **Persist artifacts** to Google Cloud Storage.
5. **Pin image + metadata** to Pinata (IPFS) using a JWT.
6. **Optionally purge GCS copies** after successful pinning.
7. **Respond** with IPFS CIDs, human-friendly gateway URLs, SHA-256 hash of metadata, and sanitized attributes.

## Prerequisites

- Google Cloud project (default code assumes `veriprompt-demo`).
- Bucket `veriprompt-assets` with public-read IAM entry (`allUsers` → `roles/storage.objectViewer`).
- Enabled services:
  - Vertex AI (`aiplatform.googleapis.com`)
  - Vision AI (`vision.googleapis.com`)
  - Cloud Storage (`storage.googleapis.com`)
- Cloud Function service account roles:
  - `roles/aiplatform.user`
  - `roles/vision.aiUser`
  - `roles/storage.objectCreator`
  - `roles/storage.objectViewer`
- Pinata account with JWT scoped for `pinFileToIPFS` and related pinning operations.

## Configuration

| Key | Description | Default |
| --- | --- | --- |
| `PINATA_JWT` | Pinata JWT token used for `pinFileToIPFS` calls. **Required**. | _none_ |
| `DELETE_GCS_AFTER_IPFS` | Hard-coded toggle in [`index.js`](index.js). When `true` the uploaded PNG/JSON are deleted from GCS and the response omits GCS URLs. Set to `false` in the code before deploying if you want to keep the bucket artifacts. | `true`

> ℹ️ Update the constant in `index.js` if you want to change the deletion behaviour; it is not read from the environment.

## Deployment

Install dependencies locally:

```bash
npm install
```

Deploy the function (adjust runtime/region to match your project):

```bash
gcloud functions deploy generateAndStore \
  --region=europe-central2 \
  --runtime=nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars=PINATA_JWT="your_pinata_jwt"
```

Re-run the deploy command whenever you modify `PINATA_JWT` or the code.

## HTTP API

### Request

```http
POST /generateAndStore
Content-Type: application/json

{
  "prompt": "Describe the artwork you want"
}
```

### Success Response

```json
{
  "metadataHash": "sha256-of-json",
  "ipfsImageCid": "bafy...",
  "ipfsImageGatewayUrl": "https://gateway.pinata.cloud/ipfs/bafy...",
  "ipfsMetadataCid": "bafy...",
  "ipfsMetadataGatewayUrl": "https://gateway.pinata.cloud/ipfs/bafy...",
  "original_prompt": "Describe the artwork you want",
  "attributes": [
    { "trait_type": "original_prompt", "value": "Describe the artwork you want" },
    { "trait_type": "Surrealism", "value": "88%" },
    { "trait_type": "Vibrant color", "value": "73%" }
  ]
}
```

When `DELETE_GCS_AFTER_IPFS` is set to `false`, the payload additionally includes:

```json
{
  "imageUrl": "https://storage.googleapis.com/veriprompt-assets/...png",
  "metadataUrl": "https://storage.googleapis.com/veriprompt-assets/...json"
}
```

### Error Responses

| Status | Meaning | Client Action |
| ------ | ------- | ------------- |
| `429` | Vertex AI quota exhausted (`RESOURCE_EXHAUSTED`). | Retry after a backoff. |
| `504` | Vertex AI request timed out (`DEADLINE_EXCEEDED`). | Retry after a short delay. |
| `500` | Generic failure (Pinata auth, storage error, etc.). The response body contains a descriptive message. | Inspect logs & configuration. |

## Pinata Configuration

1. Open Pinata → **Settings → API Keys**.
2. Create a new key with `pinFileToIPFS` (and optional `unpin`, `pinJobs`) scopes.
3. Copy the JWT and store it safely.
4. Set/rotate `PINATA_JWT` before redeploying the function.

## Local Development & Testing

- The Cloud Function entry point is `functions.http('generateAndStore', ...)` in [`index.js`](index.js).
- Use `npm install` to sync the `node_modules` used during deployment.
- You can invoke the handler locally with the Functions Framework emulator:

```bash
npx @google-cloud/functions-framework --target=generateAndStore
```

Then POST to `http://localhost:8080/generateAndStore` with the same payload as production.

> Note: local execution still requires valid Google Cloud credentials and access to Vertex, Vision, and Pinata.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `Pinata image upload failed (403): NO_SCOPES_FOUND` | Regenerate the Pinata JWT with the correct scopes. Update `PINATA_JWT` and redeploy. |
| `Service is temporarily saturated` (429) | Vertex quota reached. Either wait, increase quota, or reduce request rate. |
| `Image generation timed out` (504) | Vertex took too long. Retry; consider simplifying prompts or checking service status. |
| `PINATA_JWT is not configured` | Set the env var before deployment. |
| Missing CORS headers | The function sets permissive CORS; ensure the client sends CORS preflight if using custom headers. |

## Security Notes

- The bucket uses uniform access with IAM; there is no `file.makePublic()` call. Public reads rely on the bucket-level `allUsers` role.
- Secrets such as `PINATA_JWT` must be stored in environment variables or Secret Manager (recommended) rather than in source control.
- Returned metadata is sanitized (length-capped) before pinning or returning to callers.

## Further Improvements

- Move `PINATA_JWT` to Secret Manager and fetch at runtime.
- Parameterize `DELETE_GCS_AFTER_IPFS` via environment variable or request flag.
- Add automated tests for response structure and error handling.
- Implement caching or queueing for rate-limited Vertex workloads.

## 📄 License

Released under the [MIT License](LICENSE). You may use, modify, and distribute this project freely, including in commercial applications, provided the original copyright notice and this permission notice are included.
