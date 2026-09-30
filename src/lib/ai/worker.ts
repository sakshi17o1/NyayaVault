import { pipeline, env } from '@huggingface/transformers';

// Configure for offline, local model usage
// The user will download the model to public/models/ for strict air-gap.
// We set allowRemoteModels to true for prototype purposes so it downloads on first run,
// but for production air-gap, it should be false.
env.allowRemoteModels = true; // Must be true so fetch() works even for local HTTP server
env.allowLocalModels = true;
env.localModelPath = '/models/';

class MyPipeline {
  static task: any = 'text2text-generation';
  static model = 'Xenova/LaMini-Flan-T5-77M';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      try {
        // Attempt WebGPU first (Massive Speedup)
        console.log("[AI Worker] Attempting to load model on WebGPU...");
        this.instance = await pipeline(this.task, this.model, { 
          progress_callback,
          device: 'webgpu',
          dtype: 'q4'
        } as any);
        console.log("[AI Worker] WebGPU initialized successfully! 🚀");
      } catch (err) {
        console.warn("[AI Worker] WebGPU failed or unsupported, falling back to CPU (WASM).", err);
        // Fallback to CPU/WASM
        this.instance = await pipeline(this.task, this.model, { 
          progress_callback,
          device: 'wasm',
          dtype: 'q8'
        } as any);
      }
    }
    return this.instance;
  }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event: MessageEvent) => {
  const { id, type, payload } = event.data;
  
  if (type === 'GENERATE') {
    const { prompt } = payload;
    
    try {
      // Retrieve the pipeline. It will download the model the first time (if online/allowRemote)
      const generator = await MyPipeline.getInstance((x: any) => {
        // Send progress updates back to the main thread
        self.postMessage({
          id,
          type: 'PROGRESS',
          payload: x,
        });
      });

      // Generate the text
      const output = await generator(prompt, {
        max_new_tokens: 150,
        temperature: 0.1,
        do_sample: false,
        repetition_penalty: 1.15,
      });

      // Send the result back
      self.postMessage({
        id,
        type: 'COMPLETE',
        payload: {
          result: output[0].generated_text
        }
      });
    } catch (error: any) {
      console.error(error);
      self.postMessage({
        id,
        type: 'ERROR',
        payload: {
          error: error.message
        }
      });
    }
  }
});
