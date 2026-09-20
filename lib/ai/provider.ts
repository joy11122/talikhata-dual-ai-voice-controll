import OpenAI from 'openai';
export type AIProviderName='openai'|'openrouter';
export function getAIProviders():AIProviderName[]{const p:AIProviderName[]=[];if(process.env.OPENAI_API_KEY)p.push('openai');if(process.env.OPENROUTER_API_KEY)p.push('openrouter');return p;}
export function createAIClient(provider:AIProviderName){if(provider==='openai'){if(!process.env.OPENAI_API_KEY)throw new Error('OpenAI is not configured');return new OpenAI({apiKey:process.env.OPENAI_API_KEY});}if(!process.env.OPENROUTER_API_KEY)throw new Error('OpenRouter is not configured');return new OpenAI({apiKey:process.env.OPENROUTER_API_KEY,baseURL:'https://openrouter.ai/api/v1',defaultHeaders:{'HTTP-Referer':process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000','X-Title':'TaliKhata Voice'}});}
export function getModel(provider:AIProviderName){return provider==='openai'?(process.env.OPENAI_VOICE_MODEL||'gpt-4.1-mini'):(process.env.OPENROUTER_MODEL||'openrouter/free');}
export function shouldFallback(error:unknown){const status=Number((error as any)?.status||(error as any)?.response?.status||0);return status===408||status===429||status>=500||error instanceof TypeError;}
