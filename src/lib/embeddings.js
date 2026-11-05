import { env, pipeline } from '@huggingface/transformers';
import { access } from 'node:fs/promises';
import path from 'node:path';

const modelId = 'Xenova/all-MiniLM-L6-v2';
let extractorPromise;

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = process.env.PDA_MODELS_DIR || `${process.cwd()}/models`;
env.useFSCache = false;

export function embeddingModelAvailable() {
  return modelId;
}

export async function isEmbeddingModelAvailable() {
  const root = process.env.PDA_MODELS_DIR || path.join(process.cwd(), 'models');
  try {
    await Promise.all([
      access(path.join(/*turbopackIgnore: true*/ root, modelId, 'config.json')),
      access(path.join(/*turbopackIgnore: true*/ root, modelId, 'tokenizer.json')),
      access(path.join(/*turbopackIgnore: true*/ root, modelId, 'onnx', 'model_quantized.onnx')),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function embedText(text) {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', modelId, { dtype: 'q8' });
  }
  const extractor = await extractorPromise;
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  const vector = output.tolist()[0];
  if (vector.length !== 384 || vector.some((value) => !Number.isFinite(value))) {
    throw new Error('The local embedding model did not produce a finite 384-dimensional vector.');
  }
  return vector;
}

export function vectorLiteral(vector) {
  if (vector.length !== 384) throw new Error('Embedding vectors must contain 384 values.');
  return `[${vector.join(',')}]`;
}
