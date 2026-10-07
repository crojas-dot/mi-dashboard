import 'server-only';
import { createHash } from 'node:crypto';
import { validarBaseUrl } from '@/lib/ai/providerUrl';
import { getUserError } from '@/lib/errors/userError';
import type { AIProvider, AIRouting } from '@/lib/ai/types';
import type { SupabaseClient } from '@supabase/supabase-js';
export class AISettingsInputError extends Error {
}
export class AISettingsConflictError extends Error {
}
export const AI_SETTINGS_KEYS = ['ai_providers', 'ai_routing', 'ai_cache_ttl_minutes'];
export function validSettingKey(key: unknown): key is string {
    return typeof key === 'string' && (AI_SETTINGS_KEYS.includes(key) || /^ai_test_resultado_[a-zA-Z0-9_-]{1,128}$/.test(key));
}
export function publicProviders(value: unknown): AIProvider[] {
    if (!Array.isArray(value))
        return [];
    return value.filter(p => p && typeof p === 'object').map((p: AIProvider) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, base_url: displayURL(p.base_url), api_key: '', has_api_key: !!p.api_key || p.has_api_key === true,
        modelos: Array.isArray(p.modelos) ? p.modelos.filter(m => typeof m === 'string') : [], tokens_usados: p.tokens_usados ?? 0, limite_tokens: p.limite_tokens ?? 0, tokens_updated_at: p.tokens_updated_at }));
}
function displayURL(value: unknown) {
    try {
        return validateProviderURL(value);
    }
    catch {
        return undefined;
    }
}
export function publicTestResult(value: unknown) {
    if (!value || typeof value !== 'object' || !Array.isArray((value as {
        resultados?: unknown;
    }).resultados))
        return null;
    const result = value as {
        timestamp: unknown;
        resultados: Record<string, unknown>[];
    };
    return { timestamp: typeof result.timestamp === 'number' ? result.timestamp : 0, resultados: result.resultados.filter(r => r && typeof r === 'object').map(r => ({
            modelo: typeof r.modelo === 'string' ? r.modelo : '', ok: r.ok === true, latenciaMs: typeof r.latenciaMs === 'number' ? r.latenciaMs : null,
            error: r.ok === true ? null : getUserError({ message: r.error }, 'No se pudo probar este modelo.').message,
        })) };
}
export function validateProviderURL(value: unknown): string | undefined {
    if (value === undefined || value === '')
        return undefined;
    if (typeof value !== 'string' || value.length > 2048)
        throw new AISettingsInputError('URL Base inválida.');
    let url: URL;
    try {
        url = new URL(value.trim());
    }
    catch {
        throw new AISettingsInputError('URL Base inválida.');
    }
    if (!validarBaseUrl(url.toString()))
        throw new AISettingsInputError('Usa una URL HTTPS de un proveedor permitido, sin credenciales ni parámetros.');
    return url.toString().replace(/\/+$/, '');
}
export function normalizeProviders(value: unknown): AIProvider[] {
    if (!Array.isArray(value) || value.length > 100)
        throw new AISettingsInputError('La lista de proveedores es inválida.');
    const ids = new Set<string>();
    return value.map(raw => {
        if (!raw || typeof raw !== 'object')
            throw new AISettingsInputError('Proveedor inválido.');
        const p = raw as Record<string, unknown>;
        if (typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(p.id) || ids.has(p.id))
            throw new AISettingsInputError('Identificador de proveedor inválido o repetido.');
        ids.add(p.id);
        if (typeof p.nombre !== 'string' || !p.nombre.trim() || p.nombre.length > 200 || !['gemini', 'anthropic', 'openai'].includes(String(p.tipo)))
            throw new AISettingsInputError('Nombre o tipo de proveedor inválido.');
        if (typeof p.api_key !== 'string' || p.api_key.length > 8192)
            throw new AISettingsInputError('La clave del proveedor es inválida.');
        if (!Array.isArray(p.modelos) || p.modelos.length > 200 || p.modelos.some(m => typeof m !== 'string' || !m.trim() || m.length > 500))
            throw new AISettingsInputError('Lista de modelos inválida.');
        if (typeof p.limite_tokens !== 'number' || !Number.isSafeInteger(p.limite_tokens) || p.limite_tokens < 0)
            throw new AISettingsInputError('Límite de tokens inválido.');
        return { id: p.id, nombre: p.nombre.trim(), tipo: p.tipo as AIProvider['tipo'], base_url: validateProviderURL(p.base_url), api_key: p.api_key.trim(),
            modelos: [...new Set(p.modelos.map(m => (m as string).trim()))], limite_tokens: p.limite_tokens, tokens_usados: 0 };
    });
}
export function normalizeRouting(value: unknown): AIRouting {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new AISettingsInputError('Enrutamiento inválido.');
    const result: AIRouting = {};
    for (const [module, raw] of Object.entries(value)) {
        if (!['quejas', 'sacp', 'documentos', 'auditorias', 'riesgos', 'revision', 'general'].includes(module) || !raw || typeof raw !== 'object')
            throw new AISettingsInputError('Ruta de IA inválida.');
        const route = raw as Record<string, unknown>;
        for (const key of ['proveedor_id', 'modelo_nombre', 'fallback_provider_id', 'fallback_modelo', 'system_prompt'])
            if (route[key] !== undefined && (typeof route[key] !== 'string' || (route[key] as string).length > 20000))
                throw new AISettingsInputError('Campo de enrutamiento inválido.');
        if (typeof route.proveedor_id !== 'string' || typeof route.modelo_nombre !== 'string')
            throw new AISettingsInputError('Ruta incompleta.');
        result[module] = { proveedor_id: route.proveedor_id, modelo_nombre: route.modelo_nombre, system_prompt: route.system_prompt as string | undefined, fallback_provider_id: route.fallback_provider_id as string | undefined, fallback_modelo: route.fallback_modelo as string | undefined };
    }
    return result;
}
export async function readAISetting(admin: SupabaseClient, key: string): Promise<unknown> {
    const { data, error } = await admin.from('configuraciones_sistema').select('valor').eq('clave', key).maybeSingle();
    if (error)
        throw error;
    return data?.valor ?? null;
}
// La revisión excluye consumo: editar no debe restaurar un contador anterior.
// xmin se usa solo durante esta petición: detecta cualquier UPDATE concurrente
// sin incluir claves del JSONB en el URL de PostgREST. No es una revisión durable.
export function providersRevision(value: unknown): string {
    const settings = (Array.isArray(value) ? value : []).map(p => ({
        id: p?.id, nombre: p?.nombre, tipo: p?.tipo, base_url: p?.base_url, api_key: p?.api_key,
        modelos: p?.modelos, limite_tokens: p?.limite_tokens,
    }));
    return createHash('sha256').update(JSON.stringify(settings)).digest('hex');
}
export async function writeAISetting(admin: SupabaseClient, key: string, value: unknown, resetTokens: unknown = [], expectedRevision?: unknown): Promise<unknown> {
    let validated: unknown = value;
    if (key === 'ai_providers') {
        const providers = normalizeProviders(value);
        if (!Array.isArray(resetTokens) || resetTokens.some(id => typeof id !== 'string' || !providers.some(p => p.id === id)))
            throw new AISettingsInputError('Reinicio de consumo inválido.');
        if (typeof expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(expectedRevision))
            throw new AISettingsInputError('Falta la revisión de la configuración.');
        const { data: row, error: readError } = await admin.from('configuraciones_sistema').select('valor,xmin').eq('clave', key).maybeSingle();
        if (readError)
            throw readError;
        if (providersRevision(row?.valor) !== expectedRevision)
            throw new AISettingsConflictError('La configuración cambió. Recarga antes de guardar.');
        const current = Array.isArray(row?.valor) ? row.valor as AIProvider[] : [];
        const merged = providers.map(p => {
            const previous = current.find(item => item.id === p.id);
            if (!p.api_key && (!previous?.api_key || p.tipo !== previous.tipo || validateProviderURL(p.base_url) !== validateProviderURL(previous.base_url))) {
                throw new AISettingsInputError('Indica una clave para proveedores nuevos o al cambiar URL o tipo.');
            }
            return { ...p, api_key: p.api_key || previous?.api_key || '', tokens_usados: resetTokens.includes(p.id) ? 0 : previous?.tokens_usados ?? 0,
                ...(previous?.tokens_updated_at ? { tokens_updated_at: previous.tokens_updated_at } : {}) };
        });
        const record = { clave: key, valor: merged, descripcion: 'Configuración del subsistema IA', categoria: 'ia' };
        let query;
        if (row) {
            if (row.xmin === undefined) throw new Error('Versión de configuración no disponible');
            query = admin.from('configuraciones_sistema').update(record).eq('clave', key).eq('xmin', row.xmin);
        }
        else
            query = admin.from('configuraciones_sistema').insert(record);
        const { data: saved, error } = await query.select('valor').maybeSingle();
        if (error?.code === '23505')
            throw new AISettingsConflictError('La configuración cambió. Recarga antes de guardar.');
        if (error)
            throw error;
        if (!saved)
            throw new AISettingsConflictError('La configuración o el consumo cambió durante el guardado. Recarga e inténtalo de nuevo.');
        return { valor: publicProviders(saved.valor), revision: providersRevision(saved.valor) };
    }
    if (key === 'ai_routing')
        validated = normalizeRouting(value);
    else if (key === 'ai_cache_ttl_minutes') {
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 525600)
            throw new AISettingsInputError('TTL inválido.');
    }
    else if (key.startsWith('ai_test_resultado_')) {
        validated = publicTestResult(value);
        if (!validated)
            throw new AISettingsInputError('Resultado de test inválido.');
    }
    else
        throw new AISettingsInputError('Configuración no permitida.');
    const { error } = await admin.from('configuraciones_sistema').upsert({ clave: key, valor: validated, descripcion: 'Configuración del subsistema IA', categoria: 'ia' }, { onConflict: 'clave' });
    if (error)
        throw error;
    return validated;
}
