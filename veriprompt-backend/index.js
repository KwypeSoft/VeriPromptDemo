const functions = require('@google-cloud/functions-framework');
const aiplatform = require('@google-cloud/aiplatform');
const { Storage } = require('@google-cloud/storage');
const { helpers } = aiplatform;
const crypto = require('crypto'); // Added for hashing prompt
const vision = require('@google-cloud/vision');
const axios = require('axios');
const FormData = require('form-data');

const { PredictionServiceClient } = aiplatform.v1;

const BUCKET_NAME = 'veriprompt-assets';  // e.g., veriprompt-assets
const PROJECT_ID = 'veriprompt-demo';  // e.g., veriprompt-12345
const LOCATION = 'europe-central2';

// Clients
const clientOptions = { apiEndpoint: `${LOCATION}-aiplatform.googleapis.com` };
const predictionServiceClient = new PredictionServiceClient(clientOptions);
const storage = new Storage({ projectId: PROJECT_ID });
const visionClient = new vision.ImageAnnotatorClient({ projectId: PROJECT_ID });

const PINATA_JWT = process.env.PINATA_JWT;
const DELETE_GCS_AFTER_IPFS = true;

const RESOURCE_EXHAUSTED = 8;
const DEADLINE_EXCEEDED = 4;

if (!PINATA_JWT) {
  console.error('PINATA_JWT environment variable is not set.');
}

functions.http('generateAndStore', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  const prompt = req.body.prompt;
  if (!prompt) return res.status(400).send('No prompt provided.');

  let extractedAttributes = [];

  try {
    // Generate a hash of the prompt for unique file names
    const promptHash = crypto.createHash('md5').update(prompt).digest('hex').slice(0, 8);

    // Vertex AI Imagen request
    const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/imagen-3.0-generate-001`;
    const promptText = { prompt: `High quality, photographic. ${prompt}` };
    const instanceValue = helpers.toValue(promptText);
    const instances = [instanceValue];
    const parameter = {
      sampleCount: 1,
      aspectRatio: '1:1',
      safetyFilterLevel: 'block_some',
      personGeneration: 'allow_adult',
    };
    const parameters = helpers.toValue(parameter);
    const request = { endpoint, instances, parameters };

    const [response] = await predictWithRetry(request);
    const predictions = response.predictions;
    if (!predictions || predictions.length === 0) throw new Error('No image generated.');

    const predictionPayload = helpers.fromValue(predictions[0]) || {};
    const base64Image =
      predictionPayload.bytesBase64Encoded ||
      predictions[0].structValue?.fields?.bytesBase64Encoded?.stringValue;
    if (!base64Image) throw new Error('No image data returned.');
    delete predictionPayload.bytesBase64Encoded;

    extractedAttributes = Object.entries(predictionPayload)
      .filter(([key]) => key !== 'content')
      .filter(([, value]) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0 && value.length <= 500;
        if (typeof value === 'number' || typeof value === 'boolean') return true;
        return false;
      })
      .map(([key, value]) => ({
        trait_type: key,
        value: typeof value === 'string' ? value : String(value),
      }))
      .slice(0, 5);

    const imageBuffer = Buffer.from(base64Image, 'base64');
    const visionAttributes = await extractVisionAttributes(imageBuffer);
    const attributes = mergeAttributes(prompt, extractedAttributes, visionAttributes);
    const imageName = `prompt-${promptHash}-${Date.now()}.png`; // Explicit destination
    const imageUrl = await uploadToGCS(imageBuffer, imageName, 'image/png');
    const imagePin = await uploadBufferToIPFS(imageBuffer, imageName, 'image/png');
    const metadata = {
      name: "VeriPrompt AI Art",
      description: "An AI-generated artwork from VeriPrompt.",
      image: `ipfs://${imagePin.cid}`,
      image_gateway: imagePin.gatewayUrl,
      original_prompt: prompt,
      attributes,
    };
    
    const metadataBuffer = Buffer.from(JSON.stringify(metadata));
    const metadataName = `metadata-${promptHash}-${Date.now()}.json`; // Explicit destination
    const metadataUrl = await uploadToGCS(metadataBuffer, metadataName, 'application/json');
    const metadataPin = await uploadJsonToIPFS(metadataBuffer, metadataName);
    const metadataHash = crypto.createHash('sha256').update(metadataBuffer).digest('hex'); // Calculate SHA-256 hash of the JSON metadata that will be stored in the NFT (ERC-721)

    if (DELETE_GCS_AFTER_IPFS) {
      await Promise.all([
        deleteFromGCS(imageName).catch((err) => console.warn(`Failed to delete image from GCS: ${err}`)),
        deleteFromGCS(metadataName).catch((err) => console.warn(`Failed to delete metadata from GCS: ${err}`)),
      ]);
    }

    const responsePayload = {
      metadataHash,
      ipfsImageCid: imagePin.cid,
      ipfsImageGatewayUrl: imagePin.gatewayUrl,
      ipfsMetadataCid: metadataPin.cid,
      ipfsMetadataGatewayUrl: metadataPin.gatewayUrl,
      original_prompt: prompt,
      attributes,
    };

    if (!DELETE_GCS_AFTER_IPFS) {
      responsePayload.imageUrl = imageUrl;
      responsePayload.metadataUrl = metadataUrl;
    }

    res.status(200).json(responsePayload);

  } catch (error) {
    console.error(error);
    const message = typeof error?.message === 'string' ? error.message : '';
    const quotaIssue =
      error?.code === RESOURCE_EXHAUSTED || message.includes('RESOURCE_EXHAUSTED');
    const timeoutIssue =
      error?.code === DEADLINE_EXCEEDED || message.includes('DEADLINE_EXCEEDED');
    if (quotaIssue) {
      return res.status(429).json({ error: 'Service is temporarily saturated. Please try again shortly.' });
    }
    if (timeoutIssue) {
      return res.status(504).json({ error: 'Image generation timed out. Please retry in a moment.' });
    }
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

async function predictWithRetry(request, maxRetries = 3, initialDelayMs = 1000) {
  let attempt = 0;
  let delay = initialDelayMs;
  while (true) {
    try {
      return await predictionServiceClient.predict(request);
    } catch (error) {
      const code = error?.code;
      const message = typeof error?.message === 'string' ? error.message : '';
      const retryable =
        code === RESOURCE_EXHAUSTED ||
        code === DEADLINE_EXCEEDED ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('DEADLINE_EXCEEDED');
      if (!retryable || attempt >= maxRetries) throw error;
      attempt += 1;
      console.warn(`Predict retry ${attempt}/${maxRetries} after ${code ?? 'unknown'}; waiting ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

// Helper to upload buffer to GCS
async function uploadToGCS(buffer, destination, contentType) {
  console.log(`Uploading to GCS: ${destination}`);
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(destination);
  await file.save(buffer, { metadata: { contentType } });
  return `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
}

async function extractVisionAttributes(imageBuffer) {
  try {
    const [result] = await visionClient.labelDetection({ image: { content: imageBuffer } });
    const labels = result.labelAnnotations || [];
    return labels
      .filter(({ description }) => description)
      .slice(0, 5)
      .map(({ description, score }) => ({
        trait_type: description.slice(0, 100),
        value: score !== undefined ? `${Math.round(score * 100)}%` : 'present',
      }));
  } catch (error) {
    console.warn('Vision attribute extraction failed:', error);
    return [];
  }
}

function mergeAttributes(prompt, vertexAttributes, visionAttributes) {
  const base = [{ trait_type: 'original_prompt', value: prompt }];
  const sanitizedVertex = vertexAttributes.map(({ trait_type, value }) => ({
    trait_type: trait_type.slice(0, 100),
    value: `${value}`.slice(0, 200),
  }));
  const combined = [...base, ...sanitizedVertex];
  const seen = new Set(combined.map(({ trait_type }) => trait_type.toLowerCase()));
  for (const attr of visionAttributes) {
    const key = attr.trait_type.toLowerCase();
    if (seen.has(key)) continue;
    combined.push(attr);
    seen.add(key);
    if (combined.length >= 6) break;
  }
  return combined.slice(0, 6);
}

async function uploadJsonToIPFS(buffer, name) {
  if (!PINATA_JWT) throw new Error('PINATA_JWT is not configured.');
  const form = new FormData();
  form.append('pinataMetadata', JSON.stringify({ name }));
  form.append('file', buffer, { filename: name, contentType: 'application/json' });

  try {
    const { data } = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return {
      cid: data.IpfsHash,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
    };
  } catch (error) {
    const status = error?.response?.status;
    const body = error?.response?.data;
    throw new Error(`Pinata metadata upload failed (${status || 'unknown'}): ${JSON.stringify(body)}`);
  }
}

async function uploadBufferToIPFS(buffer, name, contentType) {
  if (!PINATA_JWT) throw new Error('PINATA_JWT is not configured.');
  const form = new FormData();
  form.append('pinataMetadata', JSON.stringify({ name }));
  form.append('file', buffer, { filename: name, contentType });

  try {
    const { data } = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return {
      cid: data.IpfsHash,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
    };
  } catch (error) {
    const status = error?.response?.status;
    const body = error?.response?.data;
    throw new Error(`Pinata image upload failed (${status || 'unknown'}): ${JSON.stringify(body)}`);
  }
}

async function deleteFromGCS(destination) {
  const file = storage.bucket(BUCKET_NAME).file(destination);
  await file.delete({ ignoreNotFound: true });
}
