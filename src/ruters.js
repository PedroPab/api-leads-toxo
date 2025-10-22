import { Router } from 'express'
import { enqueueDebounced, runDebounceWorker } from './redis.js';
import { upsertLeadDraft } from './supabase.js';
// const controller = new Controller(client)

const router = (server) => {
    const router = Router()
    server.use('/api/v1', router)

    router.post('/leads/draft', async (req, res) => {
        const leadData = req.body
        const id = leadData.sectionId

        console.log('Procesando lead draft:', id, leadData);
        await enqueueDebounced(id, leadData, 2 * 1000);
        res.status(201).json({ message: 'Lead draft created' })
    })
}


runDebounceWorker(async ({ id, payload }) => {
    console.log('> Ejecutando job:', id, payload);
    const leadData = payload
    try {
        await upsertLeadDraft(leadData);
    } catch (error) {
        console.error('Error al upsertar lead draft:', error);
    }

});


export default router