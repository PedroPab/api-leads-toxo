import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usa la service_role en tu servidor

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// type Product = { name: string; price: number; currency: string };
// type LeadDraft = {
//     name: string;
//     phone: string;
//     email?: string | null;
//     country: string;  // 'CO'
//     state?: string | null;
//     city?: string | null;
//     address?: string | null;
//     sectionId: string;
//     domain: string;
//     url?: string | null;
//     products: Product[];
//     idStore: number;
//     meta?: Record<string, any>;
// };

export async function upsertLeadDraft(payload) {
    const row = {
        name: payload.name?.trim(),
        phone: payload.phone?.trim(),
        email: payload.email ?? null,
        country: payload.country.toUpperCase(),
        state: payload.state ?? null,
        city: payload.city ?? null,
        address: payload.address ?? null,
        section_id: payload.sectionId,
        domain: payload.domain,
        url: payload.url ?? null,
        products: payload.products ?? [],
        id_store: payload.idStore,
        meta: payload.meta ?? {},
    };

    const { data, error } = await supabase
        .from('leads_draft')
        .upsert(row, {
            onConflict: 'domain,section_id,phone', // ¡coincide con el UNIQUE!
            ignoreDuplicates: false,
        })
        .select()
        .limit(1);

    if (error) throw error;
    return data?.[0] ?? null;
}
