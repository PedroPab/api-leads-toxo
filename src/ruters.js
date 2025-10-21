import { Router } from 'express'
import Controller from './controller.js'
import { enqueueDebounced, runWorker } from './redis.js';
// const controller = new Controller(client)

const router = (server) => {
    const router = Router()
    server.use('/api/v1', router)

    router.post('/leads/draft', async (req, res) => {
        const leadData = req.body
        const id = leadData.id

        // const dataRta = await controller.processLeadDraft(id, leadData)
        console.log('Procesando lead draft:', id, leadData);
        await enqueueDebounced(id, leadData, 5 * 1000);
        res.status(201).json({ message: 'Lead draft created' })
    })
}

runWorker(async ({ id, payload }) => {
    console.log('> Ejecutando job:', id, payload);
    // Tu lógica real aquí (guardar en DB, llamar API, enviar email, etc.)
});


export default router